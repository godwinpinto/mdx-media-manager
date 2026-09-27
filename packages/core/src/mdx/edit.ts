import type { Nodes, RootContent } from 'mdast';
import MagicString from 'magic-string';
import { EditError } from './errors';
import {
  findImages,
  imageUrl,
  isImage,
  locate,
  toFlow,
  type ImageNode,
  type Located,
  type SourceTarget,
} from './locate';
import { parse, type SourceFormat } from './parse';

export interface ImageRef {
  /** The block/element the image was rendered in (or the image itself when it has a position) */
  target: SourceTarget;
  /** The image's URL as written in source (e.g. `/images/x.webp`), used to pick among several */
  url?: string;
  /** Fallback when `url` is not known: index among images inside `target` */
  index?: number;
}

export interface InsertImageInput {
  target: SourceTarget;
  position: 'before' | 'after';
  url: string;
  alt: string;
}

export interface ReplaceImageInput {
  image: ImageRef;
  url: string;
  alt?: string;
}

function startOf(node: Nodes): number {
  const offset = node.position?.start.offset;
  if (offset === undefined) throw new EditError('UNSUPPORTED', 'Node has no source position.');
  return offset;
}

function endOf(node: Nodes): number {
  const offset = node.position?.end.offset;
  if (offset === undefined) throw new EditError('UNSUPPORTED', 'Node has no source position.');
  return offset;
}

function lineStart(source: string, offset: number): number {
  return source.lastIndexOf('\n', offset - 1) + 1;
}

function lineEnd(source: string, offset: number): number {
  const i = source.indexOf('\n', offset);
  return i === -1 ? source.length : i;
}

/**
 * What must precede every line of a new block placed next to `offset`, e.g. `  ` inside a JSX
 * element or list item, `> ` inside a blockquote. List markers become spaces.
 */
function continuationPrefix(source: string, offset: number): string {
  return source.slice(lineStart(source, offset), offset).replace(/[^\s>]/g, ' ');
}

function isBlank(text: string): boolean {
  return /^[\s>]*$/.test(text);
}

function markdownImage(alt: string, url: string, title?: string | null): string {
  const escapedAlt = alt.replace(/([\\[\]])/g, '\\$1');
  const escapedUrl = /[\s()<>]/.test(url) ? `<${url}>` : url;
  const escapedTitle = title ? ` "${title.replace(/"/g, '\\"')}"` : '';
  return `![${escapedAlt}](${escapedUrl}${escapedTitle})`;
}

function verify(result: string, format: SourceFormat, url: string | undefined): string {
  let tree;
  try {
    tree = parse(result, format);
  } catch (error) {
    throw new EditError(
      'INVALID',
      `The edit would produce invalid ${format.toUpperCase()}: ${(error as Error).message}`,
    );
  }
  if (url !== undefined) {
    let found = false;
    const visit = (node: Nodes) => {
      if (found) return;
      if (isImage(node) && imageUrl(node) === url) found = true;
      else if ('children' in node) node.children.forEach((child) => visit(child as Nodes));
    };
    visit(tree);
    if (!found) {
      throw new EditError(
        'INVALID',
        'The image could not be placed here without changing its meaning.',
      );
    }
  }
  return result;
}

/**
 * Insert a markdown image as a new block before/after the block containing `target`.
 */
export function insertImage(source: string, input: InsertImageInput, format: SourceFormat): string {
  const tree = parse(source, format);
  let anchor = toFlow(locate(tree, input.target));

  // In a tight list, a new block would need blank lines, which makes the whole list loose (the
  // items get paragraph spacing). Put the image on its own line in the item's paragraph instead.
  const item =
    anchor.node.type === 'listItem'
      ? anchor.node
      : anchor.parent.type === 'listItem'
        ? anchor.parent
        : undefined;
  const list = item && (anchor.node === item ? anchor.parent : anchor.ancestors.at(-2));
  if (item && list?.type === 'list' && !list.spread && !item.spread) {
    const paragraph =
      anchor.node.type === 'paragraph'
        ? anchor.node
        : item.children.find((child) => child.type === 'paragraph');
    if (paragraph) {
      const tight = insertInParagraph(
        source,
        paragraph,
        input.position,
        markdownImage(input.alt, input.url),
      );
      if (staysTight(tight, list, format)) return verify(tight, format, input.url);
    }
  }

  // A list item holds blocks itself: put the image inside it, next to its content.
  if (anchor.node.type === 'listItem' && anchor.node.children.length > 0) {
    const children = anchor.node.children;
    const child = input.position === 'after' ? children.at(-1)! : children[0]!;
    anchor = {
      node: child as RootContent,
      parent: anchor.node,
      index: children.indexOf(child),
      ancestors: [...anchor.ancestors, anchor.node],
    };
  }

  const start = startOf(anchor.node);
  const end = endOf(anchor.node);
  const prefix = continuationPrefix(source, start);
  const blankLine = prefix.trimEnd();
  const image = markdownImage(input.alt, input.url);

  const s = new MagicString(source);
  if (input.position === 'after') {
    s.appendLeft(end, `\n${blankLine}\n${prefix}${image}`);
  } else {
    s.prependRight(start, `${image}\n${blankLine}\n${prefix}`);
  }
  return verify(s.toString(), format, input.url);
}

function resolveImage(
  source: string,
  ref: ImageRef,
  format: SourceFormat,
): Located & { node: ImageNode } {
  const tree = parse(source, format);
  const images = findImages(locate(tree, ref.target));
  if (images.length === 0) throw new EditError('NOT_FOUND', 'No image found at this position.');

  let found: Located | undefined;
  if (ref.url !== undefined) {
    found = images.find((located) => imageUrl(located.node as ImageNode) === ref.url);
  } else if (ref.index !== undefined) {
    found = images[ref.index];
  } else if (images.length === 1) {
    found = images[0];
  }

  if (!found)
    throw new EditError('NOT_FOUND', 'The image was not found. The file may have changed.');
  return found as Located & { node: ImageNode };
}

/** Put an image on its own line at the start or end of a paragraph (a soft line break). */
function insertInParagraph(
  source: string,
  paragraph: Nodes,
  position: 'before' | 'after',
  image: string,
): string {
  const start = startOf(paragraph);
  const prefix = continuationPrefix(source, start);
  const s = new MagicString(source);
  if (position === 'after') s.appendLeft(endOf(paragraph), `\n${prefix}${image}`);
  else s.prependRight(start, `${image}\n${prefix}`);
  return s.toString();
}

/** Whether the list that started at the same place is still tight after an edit. */
function staysTight(result: string, list: Nodes, format: SourceFormat): boolean {
  const offset = list.position?.start.offset;
  let tight = false;
  const visit = (node: Nodes) => {
    if (node.type === 'list' && node.position?.start.offset === offset) {
      tight = !node.spread && node.children.every((child) => !child.spread);
    } else if ('children' in node) node.children.forEach((child) => visit(child as Nodes));
  };
  try {
    visit(parse(result, format));
  } catch {
    return false;
  }
  return tight;
}

/** Point an existing image at a new URL (and optionally new alt text). */
export function replaceImage(
  source: string,
  input: ReplaceImageInput,
  format: SourceFormat,
): string {
  const { node } = resolveImage(source, input.image, format);
  const s = new MagicString(source);
  rewriteImage(s, source, node, input.url, input.alt);
  return verify(s.toString(), format, input.url);
}

/** Point one image node at `url` and optionally set its alt text, in place. */
function rewriteImage(
  s: MagicString,
  source: string,
  node: ImageNode,
  url: string,
  alt?: string,
): void {
  const start = startOf(node);
  const end = endOf(node);

  if (node.type === 'image') {
    s.overwrite(start, end, markdownImage(alt ?? node.alt ?? '', url, node.title));
    return;
  }

  const text = source.slice(start, end);
  const quoteSafe = (value: string, quote: string) => value.replace(new RegExp(quote, 'g'), '');
  let replaced = text.replace(
    /(\bsrc\s*=\s*)(["'])(?:(?!\2).)*\2/,
    (_, head: string, quote: string) => `${head}${quote}${url}${quote}`,
  );
  if (replaced === text && imageUrl(node) !== url) {
    throw new EditError(
      'UNSUPPORTED',
      'This image uses a dynamic `src` expression and cannot be changed.',
    );
  }
  if (alt !== undefined) {
    const withAlt = replaced.replace(
      /(\balt\s*=\s*)(["'])(?:(?!\2).)*\2/,
      (_, head: string, quote: string) => `${head}${quote}${quoteSafe(alt, quote)}${quote}`,
    );
    // No alt attribute yet: add one right after `src`.
    replaced =
      withAlt !== replaced
        ? withAlt
        : replaced.replace(
            /(\bsrc\s*=\s*(["'])(?:(?!\2).)*\2)/,
            (m, _src, quote: string) => `${m} alt=${quote}${quoteSafe(alt, quote)}${quote}`,
          );
  }
  s.overwrite(start, end, replaced);
}

export interface ImageUsage {
  url: string;
  alt: string;
  line: number;
  column: number;
  /** `markdown` for `![]()`, otherwise the JSX element name (`img`, `Image`) */
  element: string;
}

/** Every image in the source with a literal URL, in document order. */
export function listImageUsages(source: string, format: SourceFormat): ImageUsage[] {
  const usages: ImageUsage[] = [];
  const visit = (node: Nodes) => {
    if (isImage(node)) {
      const url = imageUrl(node);
      const start = node.position?.start;
      if (url && start) {
        usages.push({
          url,
          alt: node.type === 'image' ? (node.alt ?? '') : jsxAlt(node),
          line: start.line,
          column: start.column,
          element: node.type === 'image' ? 'markdown' : (node.name ?? 'img'),
        });
      }
    }
    if ('children' in node) node.children.forEach((child) => visit(child as Nodes));
  };
  visit(parse(source, format));
  return usages;
}

function jsxAlt(node: Extract<ImageNode, { attributes: unknown }>): string {
  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxAttribute' && attr.name === 'alt' && typeof attr.value === 'string')
      return attr.value;
  }
  return '';
}

/**
 * Rewrite every image that uses `from`: point it at `to.url` and/or set `to.alt`.
 * @returns the new source and how many images changed
 */
export function rewriteImagesByUrl(
  source: string,
  from: string,
  to: { url?: string; alt?: string },
  format: SourceFormat,
): { source: string; count: number } {
  const images: ImageNode[] = [];
  const visit = (node: Nodes) => {
    if (isImage(node) && imageUrl(node) === from) images.push(node);
    if ('children' in node) node.children.forEach((child) => visit(child as Nodes));
  };
  visit(parse(source, format));
  if (images.length === 0) return { source, count: 0 };

  const s = new MagicString(source);
  for (const node of images) rewriteImage(s, source, node, to.url ?? from, to.alt);
  return { source: verify(s.toString(), format, to.url ?? from), count: images.length };
}

/** Remove the whole lines spanned by [start, end), plus one adjacent blank line. */
function removeLines(s: MagicString, source: string, start: number, end: number): void {
  let from = lineStart(source, start);
  let to = lineEnd(source, end);
  to = to < source.length ? to + 1 : to;

  const nextEnd = lineEnd(source, to);
  if (to < source.length && isBlank(source.slice(to, nextEnd))) {
    to = nextEnd < source.length ? nextEnd + 1 : nextEnd;
  } else if (from > 0) {
    const prevStart = lineStart(source, from - 1);
    if (isBlank(source.slice(prevStart, from - 1))) from = prevStart;
  }
  s.remove(from, to);
}

function ownsLines(source: string, start: number, end: number): boolean {
  return (
    isBlank(source.slice(lineStart(source, start), start)) &&
    isBlank(source.slice(end, lineEnd(source, end)))
  );
}

/** Remove an image; when it is alone in its block, the whole block goes. */
export function removeImage(source: string, ref: ImageRef, format: SourceFormat): string {
  const located = resolveImage(source, ref, format);
  const { node, parent } = located;
  const s = new MagicString(source);

  const aloneInParagraph =
    parent.type === 'paragraph' &&
    parent.children.every(
      (child) => child === node || (child.type === 'text' && child.value.trim() === ''),
    );

  const block: Nodes = aloneInParagraph ? parent : node;
  const start = startOf(block);
  const end = endOf(block);

  const lineS = lineStart(source, start);
  const lineE = lineEnd(source, end);
  const restOfLineBlank = isBlank(source.slice(end, lineE));
  const inParagraph = parent.type === 'paragraph' && !aloneInParagraph;

  if ((aloneInParagraph || node.type === 'mdxJsxFlowElement') && ownsLines(source, start, end)) {
    removeLines(s, source, start, end);
  } else if (
    inParagraph &&
    restOfLineBlank &&
    lineS > startOf(parent) &&
    isBlank(source.slice(lineS, start))
  ) {
    // On its own line after other text (e.g. in a tight list item): drop the line.
    s.remove(lineS - 1, lineE);
  } else if (inParagraph && restOfLineBlank && lineE < endOf(parent)) {
    // First on its line, with more text below: drop it and the line break after it.
    let to = lineE + 1;
    while (to < source.length && /[ \t>]/.test(source[to]!)) to++;
    s.remove(start, to);
  } else {
    // Inline among text: drop the image and one space next to it.
    let to = end;
    if (source[to] === ' ' && (start === 0 || source[start - 1] === ' ')) to += 1;
    s.remove(start, to);
  }
  return verify(s.toString(), format, undefined);
}

/** Every image URL referenced by the source (for orphan detection). */
export function listImageUrls(source: string, format: SourceFormat): string[] {
  const urls: string[] = [];
  const visit = (node: Nodes) => {
    if (isImage(node)) {
      const url = imageUrl(node);
      if (url) urls.push(url);
    }
    if ('children' in node) node.children.forEach((child) => visit(child as Nodes));
  };
  visit(parse(source, format));
  return urls;
}

/** The URL currently written for an image, before it is changed. */
export function findImageUrl(
  source: string,
  ref: ImageRef,
  format: SourceFormat,
): string | undefined {
  return imageUrl(resolveImage(source, ref, format).node);
}
