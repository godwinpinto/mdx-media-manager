import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectionDirs, detectContentRoots } from '../src/fumadocs';

describe('collectionDirs', () => {
  it('reads literal dirs from the macro API and source.config', () => {
    const code = `
import { defineCollections, defineDocs } from 'fumadocs-mdx/macro';
export const docs = defineDocs({ dir: 'content/docs', docs: { async: true } });
const blog = defineCollections({ type: 'doc', dir: \`content/blog\` });
const many = defineCollections({ type: 'doc', dir: ['a', '../../shared/x'] });
const dynamic = defineDocs({ dir: process.env.DIR });
`;
    expect(collectionDirs(code, 'source.ts')).toEqual([
      'content/docs',
      'content/blog',
      'a',
      '../../shared/x',
    ]);
  });

  it('reads workspace dirs', () => {
    const code = `
import { defineConfig } from 'fumadocs-mdx/config';
export default defineConfig({ workspaces: { api: { dir: '../api-docs', config: {} } } });
`;
    expect(collectionDirs(code, 'source.config.ts')).toEqual(['../api-docs']);
  });
});

describe('detectContentRoots', () => {
  let workspace: string;
  beforeAll(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mmm-detect-'));
    await fs.mkdir(path.join(workspace, 'apps/site/lib'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'shared/handbook'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, 'apps/site/lib/source.ts'),
      `import { defineDocs } from 'fumadocs-mdx/macro';
export const docs = defineDocs({ dir: 'content/docs' });
export const handbook = defineDocs({ dir: '../../shared/handbook' });
export const gone = defineDocs({ dir: '../../does-not-exist' });`,
    );
  });
  afterAll(() => fs.rm(workspace, { recursive: true, force: true }));

  it('returns existing folders outside the app', () => {
    expect(detectContentRoots(path.join(workspace, 'apps/site'))).toEqual([
      path.join(workspace, 'shared/handbook'),
    ]);
  });
});
