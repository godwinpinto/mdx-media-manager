import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  existsSync,
  imageFolderFor,
  isInside,
  isReferenced,
  publicFileOf,
  publicUrlOf,
  writeAtomic,
} from './fs';
import { EditError } from './mdx/errors';
import type { ResolvedOptions } from './options';
import { contentTypeOf, createS3Store, type S3Store } from './s3';
import { slugify } from './slug';

const hashOf = (data: Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 8);

/** `hero-1a2b3c4d.webp` → `1a2b3c4d` */
const hashInName = (name: string) => /-([0-9a-f]{8})\.[a-z0-9]+$/i.exec(name)?.[1];

export interface StoredImage {
  url: string;
  /** Undo the write (when the source edit that uses it fails) */
  discard?: () => Promise<unknown>;
}

/**
 * Where image files live: `public/` by default, or an S3 bucket served from a CDN. Every URL
 * written into content goes through here, so edits don't need to know which one is in use.
 */
export function createImageStorage(options: ResolvedOptions) {
  const s3: S3Store | undefined = options.s3 ? createS3Store(options.s3) : undefined;
  // Say so at startup if S3 is configured but the SDK isn't installed, not on the first upload
  s3?.connect().catch((error: Error) => console.error(error.message));

  /** Page image folder, relative to the images folder: `docs/guide` */
  const folderOf = (sourceFile: string) =>
    path.relative(options.imagesDir, imageFolderFor(options, sourceFile)).split(path.sep).join('/');

  const referenced = (url: string) =>
    isReferenced(options.root, options.publicDir, url, options.contentRoots);

  const storage = {
    s3,
    kind: s3 ? ('s3' as const) : ('local' as const),

    /** The S3 key for a CDN URL of this bucket */
    keyOf: (url: string) => s3?.keyOf(url),

    /** Write a new image for a page (`name` includes hash and extension). Reuses identical files. */
    async write(sourceFile: string, name: string, data: Uint8Array): Promise<StoredImage> {
      const folder = folderOf(sourceFile);
      if (s3) {
        const key = [s3.options.prefix, folder, name].filter(Boolean).join('/');
        const created = !(await s3.head(key));
        if (created) await s3.put(key, data, contentTypeOf(name));
        return { url: s3.urlOf(key), discard: created ? () => s3.delete(key) : undefined };
      }
      const file = path.join(options.imagesDir, folder, name);
      if (!isInside(options.publicDir, file))
        throw new EditError('INVALID', 'Invalid image location.');
      const created = !existsSync(file);
      if (created) await writeAtomic(file, data);
      return {
        url: publicUrlOf(options.publicDir, file),
        discard: created ? () => fs.rm(file, { force: true }) : undefined,
      };
    },

    /** Read an image this project serves (local public file or bucket object). */
    async read(url: string): Promise<{ data: Uint8Array; contentType: string } | undefined> {
      const key = s3?.keyOf(url);
      if (s3 && key) {
        const object = await s3.get(key);
        return (
          object && { data: object.data, contentType: object.contentType ?? contentTypeOf(key) }
        );
      }
      const file = publicFileOf(options.publicDir, url);
      if (!file || !existsSync(file)) return;
      return { data: await fs.readFile(file), contentType: contentTypeOf(file) };
    },

    async exists(url: string): Promise<boolean> {
      const key = s3?.keyOf(url);
      if (s3 && key) return !!(await s3.head(key));
      const file = publicFileOf(options.publicDir, url);
      return !!file && existsSync(file);
    },

    /** Delete an image we manage once no project file mentions it. */
    async removeIfOrphaned(url: string | undefined): Promise<string | undefined> {
      if (!url) return;
      const key = s3?.keyOf(url);
      if (s3 && key) {
        if (!s3.isManaged(key) || (await referenced(url))) return;
        await s3.delete(key);
        return url;
      }
      const file = publicFileOf(options.publicDir, url);
      if (!file || !isInside(options.imagesDir, file) || !existsSync(file)) return;
      if (await referenced(url)) return;
      await fs.rm(file, { force: true });
      return url;
    },

    /**
     * Copy an image to `<name>-<content hash>.<ext>` in the same folder. The old one stays until
     * nothing references it, so other pages using it keep working.
     */
    async copyUnderName(url: string, name: string): Promise<StoredImage> {
      const key = s3?.keyOf(url);
      if (s3 && key) {
        const extension = path.posix.extname(key).toLowerCase();
        let hash = hashInName(path.posix.basename(key));
        if (!hash) {
          const object = await s3.get(key);
          if (!object) throw new EditError('NOT_FOUND', `Image not found in the bucket: ${key}`);
          hash = hashOf(object.data);
        }
        const target = path.posix.join(
          path.posix.dirname(key),
          `${slugify(name)}-${hash}${extension}`,
        );
        if (target === key) return { url };
        const created = !(await s3.head(target));
        if (created) await s3.copy(key, target);
        return { url: s3.urlOf(target), discard: created ? () => s3.delete(target) : undefined };
      }

      const current = publicFileOf(options.publicDir, url);
      if (!current || !existsSync(current)) {
        throw new EditError(
          'UNSUPPORTED',
          'Only images stored in the public folder or the bucket can be renamed.',
        );
      }
      const data = await fs.readFile(current);
      const target = path.join(
        path.dirname(current),
        `${slugify(name)}-${hashOf(data)}${path.extname(current).toLowerCase()}`,
      );
      if (!isInside(options.publicDir, target))
        throw new EditError('INVALID', 'Invalid image location.');
      if (target === current) return { url };
      const created = !existsSync(target);
      if (created) await writeAtomic(target, data);
      return {
        url: publicUrlOf(options.publicDir, target),
        discard: created ? () => fs.rm(target, { force: true }) : undefined,
      };
    },

    /** Existing images in the destination folder named `<slug>` or `<slug>-<hash>` */
    async similar(slug: string, target: { url?: string; sourceFile?: string }): Promise<string[]> {
      const matches = (name: string) => {
        const base = name.replace(/\.[^.]+$/, '');
        return (
          base === slug ||
          (base.startsWith(`${slug}-`) && /^[0-9a-f]{8}$/.test(base.slice(slug.length + 1)))
        );
      };
      const currentKey = target.url ? s3?.keyOf(target.url) : undefined;

      if (s3 && (currentKey || (!target.url && target.sourceFile))) {
        const folder = currentKey
          ? path.posix.dirname(currentKey)
          : [s3.options.prefix, folderOf(target.sourceFile!)].filter(Boolean).join('/');
        const keys = await s3.list(folder, slug);
        return keys
          .filter((key) => path.posix.dirname(key) === folder && matches(path.posix.basename(key)))
          .map((key) => s3.urlOf(key))
          .filter((url) => url !== target.url);
      }

      const currentFile = target.url ? publicFileOf(options.publicDir, target.url) : undefined;
      const folder = currentFile
        ? path.dirname(currentFile)
        : imageFolderFor(options, target.sourceFile!);
      if (folder !== options.publicDir && !isInside(options.publicDir, folder)) return [];
      const entries = await fs.readdir(folder).catch(() => [] as string[]);
      return entries
        .filter(matches)
        .map((entry) => publicUrlOf(options.publicDir, path.join(folder, entry)))
        .filter((url) => url !== target.url);
    },
  };
  return storage;
}

export type ImageStorage = ReturnType<typeof createImageStorage>;
