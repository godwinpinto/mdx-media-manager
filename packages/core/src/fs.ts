import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EditError } from './mdx/errors';
import { slugify } from './slug';

export function isInside(dir: string, file: string): boolean {
  const relative = path.relative(dir, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Resolve a project-relative source path from the client, refusing anything outside `root`,
 * inside `node_modules`, reached through a symlink, or that isn't `.md`/`.mdx`.
 */
export async function resolveSourceFile(root: string, relativePath: string): Promise<string> {
  if (relativePath.includes('\0') || path.isAbsolute(relativePath)) {
    throw new EditError('INVALID', 'Invalid source path.');
  }
  const file = path.resolve(root, relativePath);
  if (
    !isInside(root, file) ||
    !/\.mdx?$/.test(file) ||
    file.split(path.sep).includes('node_modules')
  ) {
    throw new EditError('INVALID', 'Source path is outside the project content.');
  }
  let real: string;
  try {
    real = await fs.realpath(file);
  } catch {
    throw new EditError('NOT_FOUND', `Source file not found: ${relativePath}`);
  }
  if (real !== path.join(await fs.realpath(root), path.relative(root, file))) {
    throw new EditError('INVALID', 'Symlinked source files are not supported.');
  }
  return file;
}

/** Write via a temp file + rename so readers (the dev server's watcher) never see half a file. */
export async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomBytes(4).toString('hex')}.tmp`,
  );
  await fs.writeFile(temp, data);
  await fs.rename(temp, file);
}

const queues = new Map<string, Promise<unknown>>();

/** Run edits on the same file one after another. */
export function withFileLock<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(task, task);
  const settled = next.catch(() => undefined);
  queues.set(file, settled);
  void settled.then(() => {
    if (queues.get(file) === settled) queues.delete(file);
  });
  return next;
}

const scannedExtensions = /\.(mdx?|[cm]?[jt]sx?|json|ya?ml|css|html)$/;
const skippedDirs = new Set([
  'node_modules',
  '.git',
  '.next',
  '.source',
  '.turbo',
  'dist',
  'out',
  'build',
  '.output',
  '.vercel',
  '.tanstack',
  '.nitro',
  '.cache',
  'coverage',
]);

/** Text files of the project (content, code, config), skipping dependencies, build output and `skip`. */
export async function* projectFiles(dir: string, skip: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name) && full !== skip) yield* projectFiles(full, skip);
    } else if (entry.isFile() && scannedExtensions.test(entry.name)) {
      yield full;
    }
  }
}

/**
 * Whether any project file (content, pages, components, config) still mentions `url`.
 * Deliberately a plain text search: a false positive only keeps a file around.
 */
export async function isReferenced(root: string, publicDir: string, url: string): Promise<boolean> {
  for await (const file of projectFiles(root, publicDir)) {
    const text = await fs.readFile(file, 'utf8').catch(() => '');
    if (text.includes(url)) return true;
  }
  return false;
}

/** Map a site URL like `/images/a.webp` to its file in `publicDir`, if it is one. */
export function publicFileOf(publicDir: string, url: string): string | undefined {
  if (!url.startsWith('/') || url.startsWith('//')) return;
  const clean = decodeURIComponent(url.split(/[?#]/)[0]!);
  const file = path.resolve(publicDir, `.${clean}`);
  return isInside(publicDir, file) ? file : undefined;
}

export function publicUrlOf(publicDir: string, file: string): string {
  return `/${path.relative(publicDir, file).split(path.sep).map(encodeURIComponent).join('/')}`;
}

export { slugify } from './slug';

/** Folder for a page's images: `<imagesDir>/<page path inside contentDir>` */
export function imageFolderFor(
  options: { root: string; contentDir: string; imagesDir: string },
  sourceFile: string,
): string {
  const base = isInside(options.contentDir, sourceFile) ? options.contentDir : options.root;
  const page = path.relative(base, sourceFile).replace(/\.mdx?$/, '');
  const segments = page.split(path.sep).map(slugify);
  return path.join(options.imagesDir, ...segments);
}

export { existsSync };
