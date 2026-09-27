import type { Nodes, Parents, Root, RootContent } from 'mdast';
import { EditError } from './errors';

/**
 * Where a rendered element came from, as recorded by the MDX compiler in development.
 */
export interface SourceTarget {
  /** 1-based line of the element's start */
  line: number;
  /** 1-based column of the element's start */
  column: number;
  /** Compiled element name: an intrinsic tag (`p`, `li`) or a component name (`Callout`) */
  element?: string;
  /**
   * For generated blocks without a position of their own: the target is this many siblings
   * after (positive) or before (negative) the node at `line:column`.
   */
  sibling?: number;
}

export interface Located {
  node: RootContent;
  parent: Parents;
  index: number;
  /** Ancestors from the root down to (and including) `parent` */
  ancestors: Parents[];
}

/** Parents whose children are flow (block) content */
const flowParents = new Set<Nodes['type']>([
  'root',
  'blockquote',
  'listItem',
  'mdxJsxFlowElement',
  'footnoteDefinition',
]);

const elementTypes: Record<string, Nodes['type'][]> = {
  p: ['paragraph'],
  h1: ['heading'],
  h2: ['heading'],
  h3: ['heading'],
  h4: ['heading'],
  h5: ['heading'],
  h6: ['heading'],
  ul: ['list'],
  ol: ['list'],
  li: ['listItem'],
  pre: ['code'],
  code: ['code', 'inlineCode'],
  table: ['table'],
  tr: ['tableRow'],
  th: ['tableCell'],
  td: ['tableCell'],
  blockquote: ['blockquote'],
  hr: ['thematicBreak'],
  img: ['image', 'mdxJsxFlowElement', 'mdxJsxTextElement'],
  a: ['link', 'linkReference'],
  strong: ['strong'],
  em: ['emphasis'],
  del: ['delete'],
};

function matchesElement(node: Nodes, element: string): boolean {
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    return node.name === element;
  }
  return elementTypes[element]?.includes(node.type) ?? false;
}

function each(parent: Parents, ancestors: Parents[], visit: (located: Located) => void): void {
  const chain = [...ancestors, parent];
  parent.children.forEach((node, index) => {
    visit({ node: node as RootContent, parent, index, ancestors: chain });
    if ('children' in node) each(node as Parents, chain, visit);
  });
}

/**
 * Find the node a rendered element was compiled from.
 */
export function locate(tree: Root, target: SourceTarget): Located {
  const candidates: Located[] = [];
  each(tree, [], (located) => {
    const start = located.node.position?.start;
    if (start?.line === target.line && start.column === target.column) candidates.push(located);
  });

  const { element } = target;
  const found =
    (element && candidates.find((c) => matchesElement(c.node, element))) || candidates[0];
  if (!found) {
    throw new EditError(
      'NOT_FOUND',
      `No content starts at ${target.line}:${target.column}. The file may have changed.`,
    );
  }
  if (!target.sibling) return found;

  const index = found.index + target.sibling;
  const node = found.parent.children[index];
  if (!node)
    throw new EditError('NOT_FOUND', 'The target block was not found. The file may have changed.');
  return { ...found, node: node as RootContent, index };
}

/**
 * Climb from any node (inline, table cell, …) to the nearest block that sits directly in a
 * flow container — the level where an image can be inserted before/after. List items are kept
 * as-is: insertion then happens inside them.
 */
export function toFlow(located: Located): Located {
  let current = located;
  while (current.node.type !== 'listItem' && !flowParents.has(current.parent.type)) {
    const ancestors = current.ancestors.slice(0, -1);
    const parent = ancestors.at(-1);
    if (!parent) break;
    current = {
      node: current.parent as RootContent,
      parent,
      index: parent.children.indexOf(current.parent as never),
      ancestors,
    };
  }
  return current;
}

export type ImageNode =
  | Extract<Nodes, { type: 'image' }>
  | Extract<Nodes, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>;

const jsxImageNames = new Set(['img', 'Image']);

export function isImage(node: Nodes): node is ImageNode {
  if (node.type === 'image') return true;
  return (
    (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
    !!node.name &&
    jsxImageNames.has(node.name)
  );
}

/** The literal `src`/`url` of an image node, if it is a plain string */
export function imageUrl(node: ImageNode): string | undefined {
  if (node.type === 'image') return node.url;
  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxAttribute' && attr.name === 'src' && typeof attr.value === 'string') {
      return attr.value;
    }
  }
}

/** Image nodes inside (or equal to) `root`, in document order, with their direct parent */
export function findImages(root: Located): Located[] {
  const out: Located[] = [];
  if (isImage(root.node)) out.push(root);
  if ('children' in root.node) {
    each(root.node as Parents, root.ancestors.concat(root.parent), (located) => {
      if (isImage(located.node)) out.push(located);
    });
  }
  return out;
}
