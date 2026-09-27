/** Mirrors the attributes written by the MDX transform. */
export const SOURCE_ATTR = 'data-mmm';
export const IMAGE_ATTR = 'data-mmm-img';
export const MISSING_ATTR = 'data-mmm-missing';

export interface SourceTag {
  file: string;
  hash: string;
  line: number;
  column: number;
  element: string;
  /** Set on generated blocks: offset from the positioned sibling at `line:column` */
  sibling?: number;
}

export function parseTag(value: string | null): SourceTag | undefined {
  if (!value) return;
  const [file, hash, position, element, sibling] = value.split('|');
  const [line, column] = (position ?? '').split(':').map(Number);
  if (!file || !hash || !element || !line || !column) return;
  return { file, hash, line, column, element, sibling: sibling ? Number(sibling) : undefined };
}

/** Elements that live inside a block; hovering them targets the block around them. */
const inlineElements = new Set([
  'a',
  'strong',
  'em',
  'code',
  'del',
  'span',
  'sup',
  'sub',
  'br',
  'img',
  'Image',
  'input',
  'kbd',
]);

export interface Block {
  element: HTMLElement;
  tag: SourceTag;
}

/** Mirrors `WITHIN_ATTR` from the transform */
export const WITHIN_ATTR = 'data-mmm-in';

function taggedBlock(element: HTMLElement): SourceTag | undefined {
  const tag = parseTag(element.getAttribute(SOURCE_ATTR));
  if (!tag || element.tagName === 'IMG') return;
  return tag.sibling || !inlineElements.has(tag.element) ? tag : undefined;
}

/** Closest element containing all of `elements` */
function commonAncestor(elements: Element[]): Element | undefined {
  let candidate: Element | null | undefined = elements[0]?.parentElement;
  while (candidate && !elements.every((element) => candidate!.contains(element))) {
    candidate = candidate.parentElement;
  }
  return candidate ?? undefined;
}

/**
 * Components that don't pass `data-mmm` to the DOM (e.g. Fumadocs `Steps`/`Step`) still need a
 * box to insert around: use the closest element containing everything rendered inside them.
 */
export function componentBlocks(root: ParentNode = document): Map<Element, SourceTag> {
  const rendered = new Set<string>();
  for (const element of root.querySelectorAll(`[${SOURCE_ATTR}]`)) {
    const tag = parseTag(element.getAttribute(SOURCE_ATTR));
    if (tag) rendered.add(`${tag.file}|${tag.line}:${tag.column}`);
  }

  const groups = new Map<string, { tag: SourceTag; depth: number; elements: Element[] }>();
  for (const element of root.querySelectorAll(`[${WITHIN_ATTR}]`)) {
    const own = parseTag(element.getAttribute(SOURCE_ATTR));
    if (!own) continue;
    element
      .getAttribute(WITHIN_ATTR)!
      .split(';')
      .forEach((entry, depth) => {
        const [position, name] = entry.split('|');
        const [line, column] = (position ?? '').split(':').map(Number);
        if (!name || !line || !column) return;
        const key = `${own.file}|${line}:${column}`;
        if (rendered.has(key)) return; // the component's own element carries its tag
        const group = groups.get(key) ?? {
          tag: { file: own.file, hash: own.hash, line, column, element: name },
          depth,
          elements: [],
        };
        group.elements.push(element);
        groups.set(key, group);
      });
  }

  const blocks = new Map<Element, SourceTag>();
  const depths = new Map<Element, number>();
  for (const { tag, depth, elements } of groups.values()) {
    const box = commonAncestor(elements);
    // Skip boxes that are already a tagged element (e.g. a component around a single paragraph).
    if (!box || box.hasAttribute(SOURCE_ATTR)) continue;
    // Several components can share a box (Steps with one Step): keep the outermost.
    if ((depths.get(box) ?? Infinity) <= depth) continue;
    blocks.set(box, tag);
    depths.set(box, depth);
  }
  return blocks;
}

/** The innermost block with a source location that contains `node`. */
export function blockAt(node: Element | null): Block | undefined {
  let components: Map<Element, SourceTag> | undefined;
  for (let current = node as HTMLElement | null; current; current = current.parentElement) {
    let tag = current.hasAttribute(SOURCE_ATTR) ? taggedBlock(current) : undefined;
    if (!tag) {
      components ??= componentBlocks();
      tag = components.get(current);
    }
    if (tag && current.getBoundingClientRect().height > 0) return { element: current, tag };
  }
}

export interface ImageTarget {
  element: HTMLImageElement;
  tag: SourceTag;
  /** URL as written in source */
  url: string;
  /** The file doesn't exist; a placeholder is shown */
  missing: boolean;
}

export function imageAt(node: Element | null): ImageTarget | undefined {
  const element = node?.closest<HTMLImageElement>(`img[${IMAGE_ATTR}]`);
  const url = element?.getAttribute(IMAGE_ATTR);
  const tag = parseTag(element?.getAttribute(SOURCE_ATTR) ?? null);
  if (element && url && tag)
    return { element, tag, url, missing: element.hasAttribute(MISSING_ATTR) };
}
