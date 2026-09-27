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
/** CDN objects that exist never change (names contain a content hash): remember them. */
const knownRemote = new Set<string>();

async function remoteExists(url: string): Promise<boolean> {
  if (knownRemote.has(url)) return true;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (res.ok) knownRemote.add(url);
    return res.ok || (res.status !== 404 && res.status !== 403 && res.status !== 410);
  } catch {
    return true; // offline or slow: don't hide images we can't check
  }
}

export async function substituteMissingImages(
  source: string,
  options: { resourcePath: string; publicDir: string; cdnUrl?: string },
): Promise<{ code: string; missing: string[] }> {
  const format: SourceFormat = options.resourcePath.endsWith('.md') ? 'md' : 'mdx';
  let tree;
  try {
    tree = parse(source, format);
  } catch {
    return { code: source, missing: [] }; // let the real compiler report the syntax error
  }

  const replacement = pathToFileURL(placeholderFile).href;
  const s = new MagicString(source);
  /** Missing images: original URL and where it starts in the source */
  const missing: { url: string; at: number }[] = [];
  const remote: { url: string; at: number }[] = [];
  const cdnPrefix = options.cdnUrl && `${options.cdnUrl.replace(/\/+$/, '')}/`;

  const visit = (node: any) => {
    // Only Markdown images become static imports; a JSX <img> to a missing file just 404s.
    if (isImage(node) && node.type === 'image') {
      const url = imageUrl(node);
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (
        url &&
        cdnPrefix &&
        url.startsWith(cdnPrefix) &&
        start !== undefined &&
        end !== undefined
      ) {
        const at = source.indexOf(url, start);
        if (at !== -1 && at < end) remote.push({ url, at });
      } else if (url && !isExternal(url) && start !== undefined && end !== undefined) {
        const clean = decodeURIComponent(url.split(/[?#]/)[0]!);
        const file = clean.startsWith('/')
          ? path.join(options.publicDir, clean)
          : path.resolve(path.dirname(options.resourcePath), clean);
        const at = source.indexOf(url, start);
        if (!existsSync(file) && at !== -1 && at < end) {
          s.overwrite(at, at + url.length, replacement);
          missing.push({ url, at });
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);

  // Fumadocs fetches remote image sizes while compiling, so a missing CDN object fails too.
  const checks = await Promise.all(remote.map((image) => remoteExists(image.url)));
  remote.forEach((image, i) => {
    if (checks[i]) return;
    s.overwrite(image.at, image.at + image.url.length, replacement);
    missing.push(image);
  });

  // Report in document order, the order the compiled images appear in.
  const ordered = missing.sort((a, b) => a.at - b.at).map((image) => image.url);
  return { code: ordered.length ? s.toString() : source, missing: ordered };
}
