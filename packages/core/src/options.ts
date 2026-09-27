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
   * path inside it. @defaultValue 'content/docs' when it exists, otherwise 'content'
   */
  contentDir?: string;
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
}

export interface ResolvedOptions {
  root: string;
  contentDir: string;
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
    options.contentDir ??
      (existsSync(path.join(root, 'content/docs')) ? 'content/docs' : 'content'),
  );
  const publicDir = path.resolve(root, options.publicDir ?? 'public');

  return {
    root,
    contentDir,
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
