import { existsSync } from 'node:fs';
import path from 'node:path';

export type ImageFormat = 'webp' | 'avif' | 'png' | 'jpeg';

export interface ImageOutputOptions {
  /** @defaultValue 'webp' */
  format?: ImageFormat;
  /** 1–100 @defaultValue 82 */
  quality?: number;
  /** Downscale wider images to this width. `0` disables. @defaultValue 1600 */
  maxWidth?: number;
}

export interface MediaManagerOptions {
  /** Project root that contains your content and public folder. @defaultValue process.cwd() */
  root?: string;
  /**
   * Folder with your MDX content, relative to `root`. Image folders are named after a page's
   * path inside it, so each collection gets its own: `images/docs/…`, `images/blog/…`.
   * @defaultValue 'content' when it exists, otherwise the project root
   */
  contentDir?: string;
  /**
   * Extra folders with MDX content outside the project (e.g. Fumadocs `workspaces` or a shared
   * docs package in a monorepo), relative to `root` or absolute. Only `.md`/`.mdx` files in them
   * can be edited. The Next.js and Vite integrations add the ones found in your Fumadocs config.
   */
  contentRoots?: string[];
  /** Static folder served at `/`, relative to `root`. @defaultValue 'public' */
  publicDir?: string;
  /** Folder inside `publicDir` that images are written to. @defaultValue 'images' */
  imagesDir?: string;
  /** URL prefix of the API. @defaultValue '/__mdx-media' */
  basePath?: string;
  /** Defaults for processed images; the UI can override per upload. */
  image?: ImageOutputOptions;
  /** Largest accepted upload in bytes. @defaultValue 25 MB */
  maxUploadSize?: number;
  /** Hostnames allowed in addition to localhost, 127.0.0.1 and ::1 (e.g. a LAN name). */
  allowedHosts?: string[];
  /**
   * URL of the page built from a content file (path relative to `root`, e.g.
   * `../../shared/handbook/intro.mdx` for content outside the app), for "open page" links in the
   * library. Return `undefined` to use the default: `content/docs/a/index.mdx` → `/docs/a`
   * (Fumadocs' convention).
   */
  pageUrl?: (file: string) => string | undefined;
}

export interface ResolvedOptions {
  root: string;
  contentDir: string;
  contentRoots: string[];
  publicDir: string;
  imagesDir: string;
  basePath: string;
  image: Required<ImageOutputOptions>;
  maxUploadSize: number;
  allowedHosts: string[];
}

export function resolveOptions(options: MediaManagerOptions = {}): ResolvedOptions {
  const root = path.resolve(options.root ?? process.cwd());
  const contentDir = path.resolve(
    root,
    options.contentDir ?? (existsSync(path.join(root, 'content')) ? 'content' : '.'),
  );
  const contentRoots = [
    ...new Set((options.contentRoots ?? []).map((dir) => path.resolve(root, dir))),
  ];
  const publicDir = path.resolve(root, options.publicDir ?? 'public');

  return {
    root,
    contentDir,
    contentRoots,
    publicDir,
    imagesDir: path.resolve(publicDir, options.imagesDir ?? 'images'),
    basePath: (options.basePath ?? '/__mdx-media').replace(/\/$/, ''),
    image: {
      format: options.image?.format ?? 'webp',
      quality: options.image?.quality ?? 82,
      maxWidth: options.image?.maxWidth ?? 1600,
    },
    maxUploadSize: options.maxUploadSize ?? 25 * 1024 * 1024,
    allowedHosts: options.allowedHosts ?? [],
  };
}
