import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type Framework = 'next' | 'vite';
export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm';

const configNames: Record<Framework, string[]> = {
  next: [
    'next.config.ts',
    'next.config.mts',
    'next.config.mjs',
    'next.config.js',
    'next.config.cjs',
  ],
  vite: [
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.mjs',
    'vite.config.js',
    'vite.config.cts',
    'vite.config.cjs',
  ],
};

export interface Project {
  root: string;
  framework: Framework;
  configFile: string;
  packageJson: Record<string, any>;
}

export function readPackageJson(root: string): Record<string, any> | undefined {
  const file = path.join(root, 'package.json');
  if (!existsSync(file)) return;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function dependsOn(packageJson: Record<string, any>, name: string): boolean {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].some(
    (field) => packageJson[field]?.[name] !== undefined,
  );
}

export function detectProject(root: string, forced?: Framework): Project {
  const packageJson = readPackageJson(root);
  if (!packageJson)
    throw new Error(`No package.json in ${root}. Run this in your app's folder or pass --cwd.`);

  const find = (framework: Framework) =>
    configNames[framework].find((name) => existsSync(path.join(root, name)));
  const next = find('next');
  const vite = find('vite');

  let framework: Framework | undefined = forced;
  if (!framework) {
    if (next && (dependsOn(packageJson, 'next') || !vite)) framework = 'next';
    else if (vite) framework = 'vite';
  }
  const configFile = framework && find(framework);
  if (!framework || !configFile) {
    throw new Error(
      forced
        ? `No ${configNames[forced][0]!.replace('.ts', '.*')} found in ${root}.`
        : `No next.config.* or vite.config.* found in ${root}. Supported: Next.js, and Vite-based apps such as TanStack Start.`,
    );
  }
  return { root, framework, configFile: path.join(root, configFile), packageJson };
}

const lockfiles: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

/** The package manager from the nearest lockfile (monorepos keep it at the root), else the one running us. */
export function detectPackageManager(root: string): PackageManager {
  for (let dir = root; ; dir = path.dirname(dir)) {
    for (const [file, manager] of lockfiles) if (existsSync(path.join(dir, file))) return manager;
    if (path.dirname(dir) === dir) break;
  }
  const agent = process.env.npm_config_user_agent ?? '';
  return (['pnpm', 'yarn', 'bun'] as const).find((m) => agent.startsWith(m)) ?? 'npm';
}

export function installCommand(manager: PackageManager, name: string): [string, string[]] {
  switch (manager) {
    case 'pnpm':
      return ['pnpm', ['add', '-D', name]];
    case 'yarn':
      return ['yarn', ['add', '-D', name]];
    case 'bun':
      return ['bun', ['add', '-d', name]];
    default:
      return ['npm', ['install', '-D', name]];
  }
}
