import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  existsSync,
  isInside,
  isReferenced,
  scopeFiles,
  scopeOf,
  publicFileOf,
  publicUrlOf,
  withFileLock,
  writeAtomic,
} from './fs';
import { copyUnderName, removeIfOrphaned } from './images';
import { listImageUsages, rewriteImagesByUrl } from './mdx/edit';
import { EditError } from './mdx/errors';
import { hashSource } from './mdx/hash';
import { formatOf } from './mdx/parse';
import type { ResolvedOptions } from './options';

/** One place an image is used in MDX content */
export interface LibraryUsage {
  /** Source file, relative to the project root */
  file: string;
  /** `hashSource()` of the file at scan time (for per-usage edits) */
  hash: string;
  line: number;
  column: number;
  /** `markdown`, or the JSX element name */
  element: string;
  alt: string;
  /** The URL as written in source */
  url: string;
  /** Where the page is served, when known */
  pageUrl?: string;
}

export interface LibraryImage {
  /** Public URL, e.g. `/images/index/hero-1a2b3c4d.webp` */
  url: string;
  /** File name */
  name: string;
  /** Path to show: relative to the images folder when managed (`blog/hello/cover.webp`), else the URL */
  label: string;
  /** Bytes */
  size: number;
  width?: number;
  height?: number;
  format?: string;
  /** Last modified, ms since epoch */
  modified: number;
  /** Inside the managed images folder (can be deleted by the library) */
  managed: boolean;
  usages: LibraryUsage[];
  /** Non-MDX project files mentioning the URL (code, config): the image is in use, but those aren't edited */
  mentions: string[];
}

export interface LibraryPage {
  file: string;
  pageUrl?: string;
}

export interface LibraryScan {
  images: LibraryImage[];
  /** References to images that don't exist */
  broken: LibraryUsage[];
  pages: LibraryPage[];
  /** Content files that could not be parsed */
  errors: { file: string; message: string }[];
}

const imageExtensions = /\.(png|jpe?g|webp|avif|gif|svg|tiff?|heic|heif|ico|bmp)$/i;
const contentExtensions = /\.mdx?$/;
const isExternal = (url: string) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url);

/**
 * Default page URL for a content file: `content/docs/guide/index.mdx` → `/docs/guide`, which
 * matches Fumadocs' conventions. Returns undefined for files outside `content/`.
 */
export function defaultPageUrl(file: string): string | undefined {
  if (!file.startsWith('content/')) return;
  const route = file
    .slice('content'.length)
    .replace(contentExtensions, '')
    .replace(/(^|\/)index$/, '');
  return route.replace(/\/$/, '') || '/';
}

async function* filesIn(dir: string, pattern: RegExp): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) yield* filesIn(full, pattern);
    else if (entry.isFile() && pattern.test(entry.name)) yield full;
  }
}

type Metadata = { mtimeMs: number; size: number; width?: number; height?: number; format?: string };

export function createLibrary(
  options: ResolvedOptions,
  pageUrl: (file: string) => string | undefined = defaultPageUrl,
) {
  const metadataCache = new Map<string, Metadata>();
  const relative = (file: string) => path.relative(options.root, file).split(path.sep).join('/');

  async function metadataOf(file: string): Promise<Metadata | undefined> {
    const stat = await fs.stat(file).catch(() => undefined);
    if (!stat?.isFile()) return;
    const cached = metadataCache.get(file);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
    const meta = await sharp(file)
      .metadata()
      .catch(() => undefined);
    const entry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      width: meta?.width,
      height: meta?.height,
      format: meta?.format,
    };
    metadataCache.set(file, entry);
    return entry;
  }

  /** Map a URL written in a content file to the public URL of an existing or missing file */
  function resolveUrl(written: string, contentFile: string): { publicUrl?: string; file?: string } {
    if (isExternal(written)) return {};
    const clean = decodeURIComponent(written.split(/[?#]/)[0]!);
    const file = clean.startsWith('/')
      ? publicFileOf(options.publicDir, clean)
      : path.resolve(path.dirname(contentFile), clean);
    if (!file) return {};
    const publicUrl = isInside(options.publicDir, file)
      ? publicUrlOf(options.publicDir, file)
      : undefined;
    return { publicUrl, file };
  }

  async function scan(): Promise<LibraryScan> {
    const usagesByUrl = new Map<string, LibraryUsage[]>();
    const broken: LibraryUsage[] = [];
    const pages: LibraryPage[] = [];
    const errors: LibraryScan['errors'] = [];
    const otherFiles: { file: string; text: string }[] = [];

    for await (const file of scopeFiles(options, options.publicDir)) {
      const text = await fs.readFile(file, 'utf8').catch(() => undefined);
      if (text === undefined) continue;
      const rel = relative(file);
      if (!contentExtensions.test(file)) {
        otherFiles.push({ file: rel, text });
        continue;
      }

      const page = pageUrl(rel);
      // READMEs and similar still count as usages, but aren't pages to filter by.
      const external = scopeOf(options, file) !== options.root;
      if (page || external || isInside(options.contentDir, file)) {
        pages.push({ file: rel, pageUrl: page });
      }
      let usages;
      try {
        usages = listImageUsages(text, formatOf(file));
      } catch (error) {
        errors.push({ file: rel, message: (error as Error).message });
        continue;
      }
      const hash = hashSource(text);
      for (const usage of usages) {
        const resolved = resolveUrl(usage.url, file);
        if (!resolved.file) continue; // external URL
        const entry: LibraryUsage = { file: rel, hash, ...usage, pageUrl: page };
        if (!existsSync(resolved.file)) broken.push(entry);
        else if (resolved.publicUrl) {
          const list = usagesByUrl.get(resolved.publicUrl) ?? [];
          list.push(entry);
          usagesByUrl.set(resolved.publicUrl, list);
        }
      }
    }

    // Everything in the managed folder, plus other public images that content uses.
    const files = new Set<string>();
    for await (const file of filesIn(options.imagesDir, imageExtensions)) files.add(file);
    for (const url of usagesByUrl.keys()) {
      const file = publicFileOf(options.publicDir, url);
      if (file) files.add(file);
    }

    const images: LibraryImage[] = [];
    for (const file of files) {
      const meta = await metadataOf(file);
      if (!meta) continue;
      const url = publicUrlOf(options.publicDir, file);
      images.push({
        url,
        name: path.basename(file),
        label: isInside(options.imagesDir, file)
          ? path.relative(options.imagesDir, file).split(path.sep).join('/')
          : url,
        size: meta.size,
        width: meta.width,
        height: meta.height,
        format: meta.format,
        modified: meta.mtimeMs,
        managed: isInside(options.imagesDir, file),
        usages: usagesByUrl.get(url) ?? [],
        mentions: otherFiles.filter((other) => other.text.includes(url)).map((other) => other.file),
      });
    }

    images.sort((a, b) => b.modified - a.modified);
    pages.sort((a, b) => a.file.localeCompare(b.file));
    return { images, broken, pages, errors };
  }

  /** Apply `rewrite` to every content file that uses the image, one file at a time. */
  async function rewriteUsages(url: string, to: { url?: string; alt?: string }) {
    const { images } = await scan();
    const image = images.find((candidate) => candidate.url === url);
    if (!image) throw new EditError('NOT_FOUND', `Image not found: ${url}`);

    const byFile = new Map<string, Set<string>>();
    for (const usage of image.usages) {
      const written = byFile.get(usage.file) ?? new Set();
      written.add(usage.url);
      byFile.set(usage.file, written);
    }

    const updated: string[] = [];
    const failed: { file: string; message: string }[] = [];
    for (const [rel, written] of byFile) {
      const file = path.join(options.root, rel);
      try {
        await withFileLock(file, async () => {
          let text = await fs.readFile(file, 'utf8');
          let count = 0;
          for (const from of written) {
            const result = rewriteImagesByUrl(text, from, to, formatOf(file));
            text = result.source;
            count += result.count;
          }
          if (count > 0) {
            await writeAtomic(file, text);
            updated.push(rel);
          }
        });
      } catch (error) {
        failed.push({ file: rel, message: (error as Error).message });
      }
    }
    return { image, updated, failed };
  }

  return {
    scan,

    /** Rename an image and update every page that uses it. */
    async rename(url: string, name: string) {
      const image = (await scan()).images.find((candidate) => candidate.url === url);
      if (!image) throw new EditError('NOT_FOUND', `Image not found: ${url}`);
      if (!image.managed) {
        throw new EditError(
          'UNSUPPORTED',
          'Only images in the managed images folder can be renamed here.',
        );
      }
      if (image.usages.length === 0 && image.mentions.length > 0) {
        throw new EditError(
          'UNSUPPORTED',
          `This image is only used in code (${image.mentions.join(', ')}). Rename it there.`,
        );
      }

      const copy = await copyUnderName(options, url, name);
      if (copy.url === url)
        return { url, updated: [] as string[], failed: [], kept: [] as string[] };

      const { updated, failed } = await rewriteUsages(url, { url: copy.url });
      if (updated.length === 0 && image.usages.length > 0) {
        await copy.discard?.();
        throw new EditError('INVALID', failed[0]?.message ?? 'No page could be updated.');
      }
      // Kept when code/config (not editable) or a failed page still mentions it.
      const removed = await removeIfOrphaned(options, url);
      return { url: copy.url, updated, failed, removed, kept: removed ? [] : image.mentions };
    },

    /** Set the alt text of every usage of an image. */
    async setAlt(url: string, alt: string) {
      const { updated, failed } = await rewriteUsages(url, { alt });
      return { url, updated, failed };
    },

    /** Delete unused images in the managed folder; anything still referenced is skipped. */
    async deleteUnused(urls: string[]) {
      const deleted: string[] = [];
      const skipped: { url: string; reason: string }[] = [];
      for (const url of urls) {
        const file = publicFileOf(options.publicDir, url);
        if (!file || !isInside(options.imagesDir, file)) {
          skipped.push({
            url,
            reason: 'Only images in the managed images folder can be deleted here.',
          });
        } else if (!existsSync(file)) {
          skipped.push({ url, reason: 'Already gone.' });
        } else if (await isReferenced(options.root, options.publicDir, url, options.contentRoots)) {
          skipped.push({ url, reason: 'Still used.' });
        } else {
          await fs.rm(file, { force: true });
          deleted.push(url);
        }
      }
      return { deleted, skipped };
    },
  };
}

export type Library = ReturnType<typeof createLibrary>;
