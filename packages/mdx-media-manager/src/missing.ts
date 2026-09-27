import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { imageUrl, isImage, parse, type SourceFormat } from '@mdx-media-manager/core/mdx';
import MagicString from 'magic-string';

/** Shown in development in place of images whose file doesn't exist */
export const placeholderFile = fileURLToPath(
  new URL('../assets/missing-image.svg', import.meta.url),
);

const isExternal = (url: string) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url);

/**
 * Point local images whose file is missing at a placeholder. Fumadocs turns images into static
 * imports, so a single missing file would otherwise fail every page in development. Production
 * builds don't use this and still fail on broken references.
 *
 * @returns the patched source and the original URLs, in document order
 */
export function substituteMissingImages(
  source: string,
  options: { resourcePath: string; publicDir: string },
): { code: string; missing: string[] } {
  const format: SourceFormat = options.resourcePath.endsWith('.md') ? 'md' : 'mdx';
  let tree;
  try {
    tree = parse(source, format);
  } catch {
    return { code: source, missing: [] }; // let the real compiler report the syntax error
  }

  const replacement = pathToFileURL(placeholderFile).href;
  const s = new MagicString(source);
  const missing: string[] = [];

  const visit = (node: any) => {
    // Only Markdown images become static imports; a JSX <img> to a missing file just 404s.
    if (isImage(node) && node.type === 'image') {
      const url = imageUrl(node);
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (url && !isExternal(url) && start !== undefined && end !== undefined) {
        const clean = decodeURIComponent(url.split(/[?#]/)[0]!);
        const file = clean.startsWith('/')
          ? path.join(options.publicDir, clean)
          : path.resolve(path.dirname(options.resourcePath), clean);
        const at = source.indexOf(url, start);
        if (!existsSync(file) && at !== -1 && at < end) {
          s.overwrite(at, at + url.length, replacement);
          missing.push(url);
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);

  return { code: missing.length ? s.toString() : source, missing };
}
