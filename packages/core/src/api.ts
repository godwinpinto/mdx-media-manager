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

export const insertMeta = z.object({
  ...source,
  target,
  position: z.enum(['before', 'after']),
  alt: z.string().max(500),
  crop,
  output,
});

export const replaceMeta = z.object({
  ...source,
  image: imageRef,
  alt: z.string().max(500).optional(),
  crop,
  output,
});

export const deleteBody = z.object({ ...source, image: imageRef });

export type InsertMeta = z.infer<typeof insertMeta>;
export type ReplaceMeta = z.infer<typeof replaceMeta>;
export type DeleteBody = z.infer<typeof deleteBody>;

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
    meta: { crop?: z.infer<typeof crop>; output?: z.infer<typeof output> },
  ) {
    if (file.size > options.maxUploadSize)
      throw new EditError('INVALID', 'The upload is too large.');
    const processed = await processImage(new Uint8Array(await file.arrayBuffer()), {
      ...options.image,
      ...meta.output,
      crop: meta.crop,
    });
    const name = `${slugify(path.parse(file.name).name)}-${processed.hash}.${extensionOf(processed.format)}`;
    const imageFile = path.join(imageFolderFor(options, sourceFile), name);
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
