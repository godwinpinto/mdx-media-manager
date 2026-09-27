import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';

interface Node {
  type: string;
  [key: string]: unknown;
}

const skipped = new Set([
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
  'public',
  'content',
]);

/** Config and source files that may define Fumadocs collections */
function* candidates(dir: string, depth = 0): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth < 3 && !skipped.has(entry.name) && !entry.name.startsWith('.'))
        yield* candidates(full, depth + 1);
    } else if (/\.(m|c)?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      yield full;
    }
  }
}

function stringsOf(node: Node | undefined): string[] {
  if (!node) return [];
  if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
  if (node.type === 'TemplateLiteral' && (node.expressions as Node[]).length === 0) {
    return [((node.quasis as Node[])[0]!.value as { cooked: string }).cooked];
  }
  if (node.type === 'ArrayExpression')
    return (node.elements as Node[]).flatMap((e) => stringsOf(e ?? undefined));
  return [];
}

function property(object: Node | undefined, name: string): Node | undefined {
  if (object?.type !== 'ObjectExpression') return;
  for (const p of object.properties as Node[]) {
    const key = p.key as Node | undefined;
    if (p.type === 'Property' && ((key?.name as string) === name || key?.value === name))
      return p.value as Node;
  }
}

/** Literal `dir`s of `defineDocs` / `defineCollections` calls and `defineConfig({ workspaces })` */
export function collectionDirs(code: string, filename: string): string[] {
  let program: Node;
  try {
    program = parseSync(filename, code).program as unknown as Node;
  } catch {
    return [];
  }
  const dirs: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Node;
    if (n.type === 'CallExpression' && (n.callee as Node).type === 'Identifier') {
      const name = (n.callee as Node).name as string;
      const [arg] = n.arguments as Node[];
      if (name === 'defineDocs' || name === 'defineCollections')
        dirs.push(...stringsOf(property(arg, 'dir')));
      if (name === 'defineConfig') {
        const workspaces = property(arg, 'workspaces');
        for (const p of (workspaces?.properties as Node[] | undefined) ?? []) {
          dirs.push(...stringsOf(property(p.value as Node, 'dir')));
        }
      }
    }
    for (const key in n) if (key !== 'type') visit(n[key]);
  };
  visit(program);
  return dirs;
}

/**
 * Content folders outside `root` declared in the Fumadocs config (e.g. `dir: '../../docs'` or
 * `workspaces`), so their pages can be edited too. Only literal paths are found; pass others via
 * the `contentRoots` option.
 */
export function detectContentRoots(root: string): string[] {
  const roots = new Set<string>();
  for (const file of candidates(root)) {
    let code: string;
    try {
      code = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!code.includes('fumadocs-mdx')) continue;
    for (const dir of collectionDirs(code, file)) {
      const resolved = path.resolve(root, dir);
      const relative = path.relative(root, resolved);
      const outside = relative.startsWith('..') || path.isAbsolute(relative);
      if (outside && existsSync(resolved)) roots.add(resolved);
    }
  }
  return [...roots];
}
