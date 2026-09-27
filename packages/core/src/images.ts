import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync, isInside, isReferenced, publicFileOf, publicUrlOf, writeAtomic } from './fs';
import { EditError } from './mdx/errors';
import type { ResolvedOptions } from './options';
import { slugify } from './slug';

type Paths = Pick<ResolvedOptions, 'root' | 'publicDir' | 'imagesDir'>;

/** Delete an image file we manage once no project file mentions it. */
export async function removeIfOrphaned(
  options: Paths,
  url: string | undefined,
): Promise<string | undefined> {
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
export async function copyUnderName(options: Paths, url: string, name: string) {
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
