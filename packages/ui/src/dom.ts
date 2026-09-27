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

/** The innermost block-level element with a source location that contains `node`. */
export function blockAt(node: Element | null): Block | undefined {
  let current = node?.closest<HTMLElement>(`[${SOURCE_ATTR}]`);
  while (current) {
    const tag = parseTag(current.getAttribute(SOURCE_ATTR));
    const isBlock =
      tag && (tag.sibling || !inlineElements.has(tag.element)) && current.tagName !== 'IMG';
    if (isBlock && current.getBoundingClientRect().height > 0) return { element: current, tag };
    current = current.parentElement?.closest<HTMLElement>(`[${SOURCE_ATTR}]`);
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
