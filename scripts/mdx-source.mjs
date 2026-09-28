#!/usr/bin/env node
/**
 * Switch the apps between the local mdx-media-manager source and the version published on npm.
 *
 *   pnpm mdx-source                   show which one each app uses
 *   pnpm mdx-source npm               the published `beta` tag
 *   pnpm mdx-source npm 0.1.0-beta.0  an exact published version (or another tag)
 *   pnpm mdx-source local             back to the workspace source (what gets committed)
 *   pnpm mdx-source check             exit 1 unless every app uses the local source (CI)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apps = ['apps/next', 'apps/tanstack-start', 'apps/docs'];
const name = 'mdx-media-manager';
const LOCAL = 'workspace:*';

/** The spec in an app's package.json, wherever it is declared */
function read(app) {
  const file = path.join(root, app, 'package.json');
  const text = fs.readFileSync(file, 'utf8');
  const pkg = JSON.parse(text);
  const field = ['dependencies', 'devDependencies'].find((f) => pkg[f]?.[name]);
  if (!field) throw new Error(`${app}/package.json doesn't depend on ${name}`);
  return { file, text, spec: pkg[field][name] };
}

/** The version actually installed, and where it comes from */
function installed(app) {
  try {
    const dir = fs.realpathSync(path.join(root, app, 'node_modules', name));
    const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return `${version} (${dir.includes(`${path.sep}node_modules${path.sep}`) ? 'from npm' : 'local source'})`;
  } catch {
    return 'not installed';
  }
}

function status() {
  for (const app of apps) {
    const { spec } = read(app);
    const mode = spec === LOCAL ? 'local' : `npm ${spec}`;
    console.log(`${app.padEnd(20)} ${mode.padEnd(22)} installed: ${installed(app)}`);
  }
}

function set(spec) {
  for (const app of apps) {
    const { file, text, spec: current } = read(app);
    if (current === spec) continue;
    // Only this one value changes; the rest of the file keeps its formatting
    const next = text.replace(
      `"${name}": ${JSON.stringify(current)}`,
      `"${name}": ${JSON.stringify(spec)}`,
    );
    fs.writeFileSync(file, next);
  }
  console.log(spec === LOCAL ? 'Using the local source.' : `Using ${name}@${spec} from npm.`);
  execFileSync('pnpm', ['install'], { cwd: root, stdio: 'inherit' });
  status();
  if (spec !== LOCAL) {
    console.log(
      '\nRestart running dev servers. Switch back before committing: pnpm mdx-source local',
    );
  }
}

const [mode, version] = process.argv.slice(2);
if (!mode) status();
else if (mode === 'local') set(LOCAL);
else if (mode === 'npm') set(version ?? 'beta');
else if (mode === 'check') {
  const remote = apps.filter((app) => read(app).spec !== LOCAL);
  if (remote.length) {
    console.error(
      `These apps use ${name} from npm; run \`pnpm mdx-source local\`: ${remote.join(', ')}`,
    );
    process.exit(1);
  }
  console.log(`All apps use the local ${name} source.`);
} else {
  console.error('Usage: pnpm mdx-source [npm [version] | local | check]');
  process.exit(1);
}
