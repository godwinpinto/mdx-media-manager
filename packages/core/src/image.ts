import { createHash } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { EditError } from './mdx/errors';
import type { ImageFormat, ImageOutputOptions } from './options';

export interface CropRect {
  /** In pixels of the original (EXIF-oriented) image */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessOptions extends ImageOutputOptions {
  crop?: CropRect;
  /** Exact output size; when only one side is given the other keeps the aspect ratio */
  width?: number;
  height?: number;
}

export interface ProcessedImage {
  data: Buffer;
  format: ImageFormat;
  width: number;
  height: number;
  /** Short content hash, used in file names so a new image never collides with a cached one */
  hash: string;
}

const acceptedInputs = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'heif']);

/**
 * Validate, crop, resize and re-encode an upload. Re-encoding drops metadata (EXIF, GPS) and
 * anything that isn't image data.
 */
export async function processImage(
  input: Uint8Array,
  options: Required<ImageOutputOptions> & ProcessOptions,
): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new EditError('INVALID', 'The upload is not a supported image.');
  }
  if (!meta.format || !acceptedInputs.has(meta.format)) {
    throw new EditError('INVALID', `Unsupported image type: ${meta.format ?? 'unknown'}.`);
  }

  const animated = (meta.pages ?? 1) > 1;
  if (animated && options.crop) {
    throw new EditError('UNSUPPORTED', 'Cropping animated images is not supported yet.');
  }

  let pipeline = sharp(input, { animated }).autoOrient();

  if (options.crop) {
    const oriented = await sharp(input).autoOrient().toBuffer({ resolveWithObject: true });
    const { width: fullWidth, height: fullHeight } = oriented.info;
    const left = Math.max(0, Math.round(options.crop.x));
    const top = Math.max(0, Math.round(options.crop.y));
    const width = Math.min(fullWidth - left, Math.round(options.crop.width));
    const height = Math.min(fullHeight - top, Math.round(options.crop.height));
    if (width < 1 || height < 1) throw new EditError('INVALID', 'The crop area is empty.');
    pipeline = pipeline.extract({ left, top, width, height });
  }

  if (options.width || options.height) {
    pipeline = pipeline.resize({
      width: options.width || undefined,
      height: options.height || undefined,
      fit: options.width && options.height ? 'fill' : 'inside',
    });
  } else if (options.maxWidth > 0) {
    pipeline = pipeline.resize({ width: options.maxWidth, withoutEnlargement: true });
  }

  const quality = Math.min(100, Math.max(1, Math.round(options.quality)));
  switch (options.format) {
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 });
      break;
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    data,
    format: options.format,
    width: info.width,
    height: animated && info.pageHeight ? info.pageHeight : info.height,
    hash: createHash('sha256').update(data).digest('hex').slice(0, 8),
  };
}

export function extensionOf(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}
