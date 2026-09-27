import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  existsSync,
  imageFolderFor,
  isInside,
  isReferenced,
  publicFileOf,
  publicUrlOf,
  resolveSourceFile,
  slugify,
  withFileLock,
  writeAtomic,
} from './fs';
import { extensionOf, processImage } from './image';
import { EditError } from './mdx/errors';
import { findImageUrl, insertImage, removeImage, replaceImage } from './mdx/edit';
import { hashSource } from './mdx/hash';
import { formatOf } from './mdx/parse';
import { resolveOptions, type MediaManagerOptions, type ResolvedOptions } from './options';
import { createRouter, HttpError, json } from './router';
import { checkRequest } from './security';

const target = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  element: z.string().max(100).optional(),
  sibling: z.number().int().min(-1000).max(1000).optional(),
});

const imageRef = z.object({
  target,
  url: z.string().max(2048).optional(),
  index: z.number().int().nonnegative().optional(),
});

const output = z
  .object({
    format: z.enum(['webp', 'avif', 'png', 'jpeg']).optional(),
    quality: z.number().min(1).max(100).optional(),
    maxWidth: z.number().int().nonnegative().optional(),
    width: z.number().int().positive().max(10000).optional(),
    height: z.number().int().positive().max(10000).optional(),
  })
  .optional();

const crop = z
  .object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .optional();

const source = {
  /** Source file, relative to the project root, as embedded in the page */
  file: z.string().min(1).max(1024),
  /** `hashSource()` of the file when the page was compiled */
  hash: z.string().min(1).max(64),
};

/** File name without extension; slugified, and a content hash is appended */
const name = z.string().trim().min(1).max(100).optional();

export const insertMeta = z.object({
  ...source,
  target,
  position: z.enum(['before', 'after']),
  alt: z.string().max(500),
  name,
  crop,
  output,
});

export const replaceMeta = z.object({
  ...source,
  image: imageRef,
  alt: z.string().max(500).optional(),
  name,
  crop,
  output,
});

/** Rename an image and/or change its alt text, keeping the image data as is */
export const updateBody = z.object({
  ...source,
  image: imageRef,
  alt: z.string().max(500).optional(),
  name,
});

export const deleteBody = z.object({ ...source, image: imageRef });

export const namesQuery = z.object({
  file: source.file,
  name: z.string().trim().min(1).max(100),
  /** The image being renamed, if any */
  url: z.string().max(2048).optional(),
});

export type InsertMeta = z.infer<typeof insertMeta>;
export type ReplaceMeta = z.infer<typeof replaceMeta>;
export type UpdateBody = z.infer<typeof updateBody>;
export type DeleteBody = z.infer<typeof deleteBody>;
export type NamesQuery = z.infer<typeof namesQuery>;

export interface EditResponse {
  /** Source file that was edited */
  file: string;
  /** Hash of the file after the edit */
  hash: string;
  /** URL of the new image, for insert/replace */
  url?: string;
  width?: number;
  height?: number;
  /** URL of an image file that was deleted because nothing references it anymore */
  removed?: string;
}

const statusOf = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID: 400,
  UNSUPPORTED: 422,
} as const;

function mapError(error: unknown): unknown {
  if (error instanceof EditError)
    return new HttpError(statusOf[error.code], error.code, error.message);
  if (error instanceof z.ZodError) return new HttpError(400, 'INVALID', z.prettifyError(error));
  if (error instanceof SyntaxError) return new HttpError(400, 'INVALID', 'Malformed request.');
  return error;
}

/** Read the `file` + JSON `meta` fields of a multipart upload. */
function readUpload<T>(body: unknown, schema: z.ZodType<T>): { file: File; meta: T } {
  if (!(body instanceof FormData))
    throw new HttpError(415, 'INVALID', 'Expected multipart/form-data.');
  const file = body.get('file');
  const meta = body.get('meta');
  if (!(file instanceof File) || typeof meta !== 'string') {
    throw new HttpError(400, 'INVALID', 'Expected `file` and `meta` fields.');
  }
  return { file, meta: schema.parse(JSON.parse(meta)) };
}

function createOperations(options: ResolvedOptions) {
  /** Read the source and make sure it is the revision the page was rendered from. */
  async function readSource(file: string, hash: string): Promise<string> {
    const text = await fs.readFile(file, 'utf8');
    if (hashSource(text) !== hash) {
      throw new EditError(
        'CONFLICT',
        'The file changed since this page was rendered. Wait for the page to refresh and try again.',
      );
    }
    return text;
  }

  /** Process and store an upload in the page's image folder. Returns its URL. */
  async function storeImage(
    sourceFile: string,
    file: File,
    meta: { name?: string; crop?: z.infer<typeof crop>; output?: z.infer<typeof output> },
  ) {
    if (file.size > options.maxUploadSize)
      throw new EditError('INVALID', 'The upload is too large.');
    const processed = await processImage(new Uint8Array(await file.arrayBuffer()), {
      ...options.image,
      ...meta.output,
      crop: meta.crop,
    });
    const base = slugify(meta.name ?? path.parse(file.name).name);
    const imageFile = path.join(
      imageFolderFor(options, sourceFile),
      `${base}-${processed.hash}.${extensionOf(processed.format)}`,
    );
    if (!isInside(options.publicDir, imageFile))
      throw new EditError('INVALID', 'Invalid image location.');

    const created = !existsSync(imageFile);
    if (created) await writeAtomic(imageFile, processed.data);
    return {
      url: publicUrlOf(options.publicDir, imageFile),
      width: processed.width,
      height: processed.height,
      /** Undo the write when the source edit fails */
      discard: () => (created ? fs.rm(imageFile, { force: true }) : Promise.resolve()),
    };
  }

  /** Delete an image file we manage once no project file mentions it. */
  async function removeIfOrphaned(url: string | undefined): Promise<string | undefined> {
    if (!url) return;
    const file = publicFileOf(options.publicDir, url);
    if (!file || !isInside(options.imagesDir, file) || !existsSync(file)) return;
    if (await isReferenced(options.root, options.publicDir, url)) return;
    await fs.rm(file, { force: true });
    return url;
  }

  /**
   * Copy an image in `publicDir` to `<name>-<content hash>.<ext>` in the same folder. The old file
   * stays until nothing references it, so other pages using it keep working.
   */
  async function renameImage(url: string, name: string) {
    const current = publicFileOf(options.publicDir, url);
    if (!current || !existsSync(current)) {
      throw new EditError('UNSUPPORTED', 'Only images stored in the public folder can be renamed.');
    }
    const data = await fs.readFile(current);
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 8);
    const target = path.join(
      path.dirname(current),
      `${slugify(name)}-${hash}${path.extname(current).toLowerCase()}`,
    );
    if (!isInside(options.publicDir, target))
      throw new EditError('INVALID', 'Invalid image location.');
    if (target === current) return { url, discard: undefined };

    const created = !existsSync(target);
    if (created) await writeAtomic(target, data);
    return {
      url: publicUrlOf(options.publicDir, target),
      discard: () => (created ? fs.rm(target, { force: true }) : Promise.resolve()),
    };
  }

  async function commit(sourceFile: string, next: string, discard?: () => Promise<unknown>) {
    try {
      await writeAtomic(sourceFile, next);
    } catch (error) {
      await discard?.();
      throw error;
    }
    return hashSource(next);
  }

  return {
    async insert(file: File, meta: InsertMeta): Promise<EditResponse> {
      const sourceFile = await resolveSourceFile(options.root, meta.file);
      return withFileLock(sourceFile, async () => {
        const text = await readSource(sourceFile, meta.hash);
        // Validate the target before doing any image work.
        insertImage(
          text,
          { target: meta.target, position: meta.position, url: '/_', alt: meta.alt },
          formatOf(sourceFile),
        );

        const stored = await storeImage(sourceFile, file, meta);
        let next: string;
        try {
          next = insertImage(
            text,
            { target: meta.target, position: meta.position, url: stored.url, alt: meta.alt },
            formatOf(sourceFile),
          );
        } catch (error) {
          await stored.discard();
          throw error;
        }
        const hash = await commit(sourceFile, next, stored.discard);
        return {
          file: meta.file,
          hash,
          url: stored.url,
          width: stored.width,
          height: stored.height,
        };
      });
    },

    async replace(file: File, meta: ReplaceMeta): Promise<EditResponse> {
      const sourceFile = await resolveSourceFile(options.root, meta.file);
      return withFileLock(sourceFile, async () => {
        const text = await readSource(sourceFile, meta.hash);
        const format = formatOf(sourceFile);
        const previous = findImageUrl(text, meta.image, format);

        const stored = await storeImage(sourceFile, file, meta);
        let next: string;
        try {
          next = replaceImage(text, { image: meta.image, url: stored.url, alt: meta.alt }, format);
        } catch (error) {
          await stored.discard();
          throw error;
        }
        const hash = await commit(sourceFile, next, stored.discard);
        const removed = previous !== stored.url ? await removeIfOrphaned(previous) : undefined;
        return {
          file: meta.file,
          hash,
          url: stored.url,
          width: stored.width,
          height: stored.height,
          removed,
        };
      });
    },

    async update(body: UpdateBody): Promise<EditResponse> {
      const sourceFile = await resolveSourceFile(options.root, body.file);
      return withFileLock(sourceFile, async () => {
        const text = await readSource(sourceFile, body.hash);
        const format = formatOf(sourceFile);
        const previous = findImageUrl(text, body.image, format);
        if (!previous) throw new EditError('UNSUPPORTED', 'This image has no editable URL.');

        let url = previous;
        let discard: (() => Promise<unknown>) | undefined;
        if (body.name !== undefined) {
          const renamed = await renameImage(previous, body.name);
          url = renamed.url;
          discard = renamed.discard;
        }

        const next = replaceImage(text, { image: body.image, url, alt: body.alt }, format);
        if (next === text) return { file: body.file, hash: body.hash, url };
        const hash = await commit(sourceFile, next, discard);
        const removed = url !== previous ? await removeIfOrphaned(previous) : undefined;
        return { file: body.file, hash, url, removed };
      });
    },

    /**
     * Images in the destination folder that already use `name` (any content hash). Used to warn
     * about look-alike names; files never collide because the hash is part of the name.
     */
    async similarNames(query: NamesQuery): Promise<{ matches: string[] }> {
      const sourceFile = await resolveSourceFile(options.root, query.file);
      // Renames stay in the image's folder; new images go to the page's folder.
      const currentFile = query.url ? publicFileOf(options.publicDir, query.url) : undefined;
      const folder = currentFile ? path.dirname(currentFile) : imageFolderFor(options, sourceFile);
      if (folder !== options.publicDir && !isInside(options.publicDir, folder))
        return { matches: [] };

      const slug = slugify(query.name);
      const entries = await fs.readdir(folder).catch(() => [] as string[]);
      const matches = entries
        .filter((entry) => {
          const base = path.parse(entry).name;
          return (
            base === slug ||
            (base.startsWith(`${slug}-`) && /^[0-9a-f]{8}$/.test(base.slice(slug.length + 1)))
          );
        })
        .map((entry) => publicUrlOf(options.publicDir, path.join(folder, entry)))
        .filter((url) => url !== query.url);
      return { matches };
    },

    async delete(body: DeleteBody): Promise<EditResponse> {
      const sourceFile = await resolveSourceFile(options.root, body.file);
      return withFileLock(sourceFile, async () => {
        const text = await readSource(sourceFile, body.hash);
        const format = formatOf(sourceFile);
        const previous = findImageUrl(text, body.image, format);
        const hash = await commit(sourceFile, removeImage(text, body.image, format));
        return { file: body.file, hash, removed: await removeIfOrphaned(previous) };
      });
    },
  };
}

export function createMediaManager(input: MediaManagerOptions = {}) {
  const options = resolveOptions(input);
  const operations = createOperations(options);

  const handler = createRouter({
    basePath: options.basePath,
    mapError,
    routes: {
      '/status': {
        method: 'GET',
        handle: async () => ({
          ok: true,
          image: options.image,
          maxUploadSize: options.maxUploadSize,
        }),
      },
      '/images/names': {
        method: 'GET',
        handle: ({ request }) =>
          operations.similarNames(
            namesQuery.parse(Object.fromEntries(new URL(request.url).searchParams)),
          ),
      },
      '/images/insert': {
        method: 'POST',
        handle: ({ body }) => {
          const { file, meta } = readUpload(body, insertMeta);
          return operations.insert(file, meta);
        },
      },
      '/images/replace': {
        method: 'POST',
        handle: ({ body }) => {
          const { file, meta } = readUpload(body, replaceMeta);
          return operations.replace(file, meta);
        },
      },
      '/images/update': {
        method: 'POST',
        handle: ({ body }) => operations.update(updateBody.parse(body)),
      },
      '/images/delete': {
        method: 'POST',
        handle: ({ body }) => operations.delete(deleteBody.parse(body)),
      },
    },
    onRequest(request) {
      const denied = checkRequest(request, options.allowedHosts);
      if (denied) return json(403, { code: 'FORBIDDEN', message: denied });

      const length = Number(request.headers.get('content-length') ?? 0);
      if (length > options.maxUploadSize + 64 * 1024) {
        return json(413, { code: 'INVALID', message: 'The upload is too large.' });
      }
    },
  });

  return {
    /** Web-standard handler: mount it on any framework route that forwards `Request`s */
    handler,
    options,
  };
}

export type MediaManager = ReturnType<typeof createMediaManager>;
