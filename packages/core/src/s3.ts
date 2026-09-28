import type { S3Client } from '@aws-sdk/client-s3';

export interface S3Options {
  bucket: string;
  /** Public base URL objects are served from, e.g. `https://images.example.com` (CDN, R2 custom domain) */
  cdnUrl: string;
  /** @defaultValue 'auto' with a custom `endpoint` (R2), otherwise 'us-east-1' */
  region?: string;
  /** For S3-compatible services: Cloudflare R2, MinIO, DigitalOcean Spaces, … */
  endpoint?: string;
  /** Omit to use the default AWS credential chain (env, profile, SSO, …) */
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Key prefix for uploaded images. @defaultValue 'images' */
  prefix?: string;
  /** Path-style URLs (MinIO). @defaultValue false */
  forcePathStyle?: boolean;
  /** @defaultValue 'public, max-age=31536000, immutable' (names contain a content hash) */
  cacheControl?: string;
}

export type ResolvedS3Options = Required<
  Omit<S3Options, 'endpoint' | 'accessKeyId' | 'secretAccessKey'>
> &
  Pick<S3Options, 'endpoint' | 'accessKeyId' | 'secretAccessKey'>;

/**
 * S3 settings from `MDX_MEDIA_*` environment variables. Returns undefined when
 * `MDX_MEDIA_S3_BUCKET` isn't set (images stay in `public/`).
 */
export function s3OptionsFromEnv(
  env: Record<string, string | undefined> = process.env,
): S3Options | undefined {
  const bucket = env.MDX_MEDIA_S3_BUCKET?.trim();
  if (!bucket) return;
  const cdnUrl = env.MDX_MEDIA_CDN_URL?.trim();
  if (!cdnUrl) {
    throw new Error(
      '[mdx-media-manager] MDX_MEDIA_S3_BUCKET is set but MDX_MEDIA_CDN_URL is not: set the public URL your bucket is served from.',
    );
  }
  return {
    bucket,
    cdnUrl,
    region: env.MDX_MEDIA_S3_REGION || undefined,
    endpoint: env.MDX_MEDIA_S3_ENDPOINT || undefined,
    accessKeyId: env.MDX_MEDIA_S3_ACCESS_KEY_ID || undefined,
    secretAccessKey: env.MDX_MEDIA_S3_SECRET_ACCESS_KEY || undefined,
    prefix: env.MDX_MEDIA_S3_PREFIX || undefined,
    forcePathStyle: env.MDX_MEDIA_S3_FORCE_PATH_STYLE === 'true' || undefined,
  };
}

export function resolveS3Options(options: S3Options): ResolvedS3Options {
  let cdnUrl: URL;
  try {
    cdnUrl = new URL(options.cdnUrl);
  } catch {
    throw new Error(`[mdx-media-manager] Invalid CDN URL: ${options.cdnUrl}`);
  }
  return {
    ...options,
    cdnUrl: cdnUrl.href.replace(/\/+$/, ''),
    region: options.region ?? (options.endpoint ? 'auto' : 'us-east-1'),
    prefix: (options.prefix ?? 'images').replace(/^\/+|\/+$/g, ''),
    forcePathStyle: options.forcePathStyle ?? false,
    cacheControl: options.cacheControl ?? 'public, max-age=31536000, immutable',
  };
}

export interface ObjectInfo {
  size: number;
  contentType?: string;
}

/** The bucket, addressed by keys; URLs are `<cdnUrl>/<key>`. */
/** The AWS SDK is an optional peer dependency: only S3 users install it. */
export const MISSING_SDK =
  '[mdx-media-manager] S3 storage needs the AWS SDK. Install it next to mdx-media-manager: npm install -D @aws-sdk/client-s3';

type Sdk = typeof import('@aws-sdk/client-s3');

export function createS3Store(
  options: ResolvedS3Options,
  /** How the SDK is loaded (tests replace it) */
  importSdk: () => Promise<Sdk> = () => import('@aws-sdk/client-s3'),
) {
  let client: Promise<{ s3: S3Client; sdk: Sdk }> | undefined;

  const loadSdk = () =>
    importSdk().catch((error: { code?: string }) => {
      // Forget the failure, so installing the SDK works without restarting the dev server
      client = undefined;
      if (error?.code === 'ERR_MODULE_NOT_FOUND') throw new Error(MISSING_SDK, { cause: error });
      throw error;
    });

  function connect() {
    client ??= loadSdk().then((sdk) => ({
      sdk,
      s3: new sdk.S3Client({
        region: options.region,
        endpoint: options.endpoint,
        forcePathStyle: options.forcePathStyle,
        credentials:
          options.accessKeyId && options.secretAccessKey
            ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
            : undefined,
        // S3-compatible services (R2, MinIO, …) may reject the SDK's default checksum headers.
        ...(options.endpoint
          ? {
              requestChecksumCalculation: 'WHEN_REQUIRED',
              responseChecksumValidation: 'WHEN_REQUIRED',
            }
          : {}),
      }),
    }));
    return client;
  }

  const isNotFound = (error: unknown) => {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
  };

  return {
    options,
    /** Load the SDK and create the client now (to report a missing SDK at startup) */
    connect: () => connect().then(() => undefined),

    urlOf(key: string): string {
      return `${options.cdnUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
    },

    /** The key for a URL served from this bucket's CDN, if it is one */
    keyOf(url: string): string | undefined {
      const base = `${options.cdnUrl}/`;
      if (!url.startsWith(base)) return;
      const key = decodeURIComponent(url.slice(base.length).split(/[?#]/)[0]!);
      if (!key || key.split('/').some((part) => part === '..' || part === '')) return;
      return key;
    },

    /** Inside the prefix this tool writes to (can be renamed / deleted) */
    isManaged(key: string): boolean {
      return !options.prefix || key.startsWith(`${options.prefix}/`);
    },

    async head(key: string): Promise<ObjectInfo | undefined> {
      const { s3, sdk } = await connect();
      try {
        const res = await s3.send(new sdk.HeadObjectCommand({ Bucket: options.bucket, Key: key }));
        return { size: res.ContentLength ?? 0, contentType: res.ContentType };
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
    },

    async get(key: string): Promise<{ data: Uint8Array; contentType?: string } | undefined> {
      const { s3, sdk } = await connect();
      try {
        const res = await s3.send(new sdk.GetObjectCommand({ Bucket: options.bucket, Key: key }));
        return { data: await res.Body!.transformToByteArray(), contentType: res.ContentType };
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
    },

    async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
      const { s3, sdk } = await connect();
      await s3.send(
        new sdk.PutObjectCommand({
          Bucket: options.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          CacheControl: options.cacheControl,
        }),
      );
    },

    async copy(from: string, to: string): Promise<void> {
      const { s3, sdk } = await connect();
      await s3.send(
        new sdk.CopyObjectCommand({
          Bucket: options.bucket,
          Key: to,
          CopySource: `${options.bucket}/${from.split('/').map(encodeURIComponent).join('/')}`,
          CacheControl: options.cacheControl,
          MetadataDirective: 'COPY',
        }),
      );
    },

    async delete(key: string): Promise<void> {
      const { s3, sdk } = await connect();
      await s3.send(new sdk.DeleteObjectCommand({ Bucket: options.bucket, Key: key }));
    },

    /** Keys directly in `folder` that start with `startsWith` (for look-alike name checks) */
    async list(folder: string, startsWith: string): Promise<string[]> {
      const { s3, sdk } = await connect();
      const res = await s3.send(
        new sdk.ListObjectsV2Command({
          Bucket: options.bucket,
          Prefix: `${folder}/${startsWith}`,
          MaxKeys: 100,
        }),
      );
      return (res.Contents ?? []).map((object) => object.Key!).filter(Boolean);
    },
  };
}

export type S3Store = ReturnType<typeof createS3Store>;

export const contentTypes: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function contentTypeOf(name: string): string {
  return contentTypes[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';
}
