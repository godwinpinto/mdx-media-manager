import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { InitError } from './ast';
import {
  dependsOn,
  detectPackageManager,
  detectProject,
  installCommand,
  type Framework,
} from './detect';
import { addToNextConfig } from './next-config';
import { addToViteConfig } from './vite-config';

export { InitError } from './ast';
export { addToNextConfig } from './next-config';
export { addToViteConfig } from './vite-config';
export { detectProject, detectPackageManager } from './detect';

export interface InitOptions {
  cwd: string;
  framework?: Framework;
  install: boolean;
  dryRun: boolean;
  log(kind: 'ok' | 'info' | 'warn', message: string): void;
}

const mdxPackages = ['fumadocs-mdx', '@mdx-js/loader', '@next/mdx'];

export function init(options: InitOptions): void {
  const { log } = options;
  const project = detectProject(path.resolve(options.cwd), options.framework);
  const configName = path.relative(project.root, project.configFile);
  log('ok', `Detected ${project.framework === 'next' ? 'Next.js' : 'Vite'} (${configName})`);

  if (!mdxPackages.some((name) => dependsOn(project.packageJson, name))) {
    log(
      'warn',
      'No MDX integration found in package.json. mdx-media-manager is built and tested with Fumadocs MDX.',
    );
  }

  // 1. Install
  if (dependsOn(project.packageJson, 'mdx-media-manager')) {
    log('ok', 'mdx-media-manager is already in package.json');
  } else if (!options.install) {
    log('info', 'Skipped install (--no-install). Add mdx-media-manager as a devDependency.');
  } else {
    const manager = detectPackageManager(project.root);
    const [command, args] = installCommand(manager, 'mdx-media-manager');
    if (options.dryRun) {
      log('info', `Would run: ${command} ${args.join(' ')}`);
    } else {
      log('info', `Running ${command} ${args.join(' ')}`);
      const result = spawnSync(command, args, {
        cwd: project.root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
      if (result.status !== 0)
        throw new InitError(
          `${command} failed. Install mdx-media-manager as a devDependency, then run init again.`,
        );
      log('ok', 'Installed mdx-media-manager as a devDependency');
    }
  }

  // 2. Config
  const code = readFileSync(project.configFile, 'utf8');
  const edit = project.framework === 'next' ? addToNextConfig : addToViteConfig;
  const result = edit(code, configName);
  if (result.status === 'already-configured') {
    log('ok', `${configName} already uses mdx-media-manager`);
  } else if (options.dryRun) {
    log('info', `Would update ${configName}:\n\n${result.code}`);
  } else {
    writeFileSync(project.configFile, result.code);
    log('ok', `Updated ${configName}`);
  }

  log('info', `Start your dev server and hover your docs to add, replace or delete images.`);
}
