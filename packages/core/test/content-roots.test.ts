import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_HEADER, createMediaManager, hashSource } from '../src';
import { imageFolderFor, resolveSourceFile } from '../src/fs';

let workspace: string;
let app: string;
let shared: string;

const post = `# Hello\n\nFirst post.\n`;
const handbook = `# Intro\n\nShared handbook page.\n`;

beforeEach(async () => {
  // A monorepo: the app, plus a shared docs folder outside it.
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'mmm-roots-'));
  app = path.join(workspace, 'apps/site');
  shared = path.join(workspace, 'shared/handbook');
  await fs.mkdir(path.join(app, 'content/docs'), { recursive: true });
  await fs.mkdir(path.join(app, 'content/blog'), { recursive: true });
  await fs.mkdir(path.join(app, 'public'), { recursive: true });
  await fs.mkdir(shared, { recursive: true });
  await fs.writeFile(path.join(app, 'content/docs/index.mdx'), '# Docs\n');
  await fs.writeFile(path.join(app, 'content/blog/hello.mdx'), post);
  await fs.writeFile(path.join(shared, 'intro.mdx'), handbook);
  await fs.writeFile(path.join(workspace, 'secret.mdx'), '# Not content\n');
});

afterEach(() => fs.rm(workspace, { recursive: true, force: true }));

const png = () =>
  sharp({ create: { width: 20, height: 10, channels: 3, background: '#0a0' } })
    .png()
    .toBuffer();

function managerFor(contentRoots: string[] = ['../../shared/handbook']) {
  const manager = createMediaManager({ root: app, contentRoots });
  const request = (url: string, init: RequestInit = {}) =>
    manager.handler(
      new Request(`http://localhost:3000/__mdx-media${url}`, {
        ...init,
        headers: { host: 'localhost:3000', [CLIENT_HEADER]: '1', ...(init.headers as object) },
      }),
    );
  const insert = async (file: string, source: string) => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array(await png())], 'Shot.png', { type: 'image/png' }));
    form.set(
      'meta',
      JSON.stringify({
        file,
        hash: hashSource(source),
        target: { line: 1, column: 1 },
        position: 'after',
        alt: 'Shot',
      }),
    );
    return request('/images/insert', { method: 'POST', body: form });
  };
  return { request, insert };
}

describe('image folders', () => {
  const options = () => ({
    root: app,
    contentDir: path.join(app, 'content'),
    imagesDir: path.join(app, 'public/images'),
    contentRoots: [shared],
  });

  it('gives each collection its own folder', () => {
    expect(imageFolderFor(options(), path.join(app, 'content/docs/guide/setup.mdx'))).toBe(
      path.join(app, 'public/images/docs/guide/setup'),
    );
    expect(imageFolderFor(options(), path.join(app, 'content/blog/hello.mdx'))).toBe(
      path.join(app, 'public/images/blog/hello'),
    );
  });

  it('names folders for external content after the content root', () => {
    expect(imageFolderFor(options(), path.join(shared, 'intro.mdx'))).toBe(
      path.join(app, 'public/images/handbook/intro'),
    );
  });
});

describe('content roots', () => {
  it('allows editing files in a configured root outside the project', async () => {
    const scope = { root: app, contentRoots: [shared] };
    expect(await resolveSourceFile(scope, '../../shared/handbook/intro.mdx')).toBe(
      path.join(shared, 'intro.mdx'),
    );
  });

  it('still refuses everything else outside the project', async () => {
    const scope = { root: app, contentRoots: [shared] };
    await expect(resolveSourceFile(scope, '../../secret.mdx')).rejects.toThrow(/outside/);
    await expect(
      resolveSourceFile({ root: app, contentRoots: [] }, '../../shared/handbook/intro.mdx'),
    ).rejects.toThrow(/outside/);
  });

  it('inserts into a blog post and a shared page', async () => {
    const { insert } = managerFor();
    const blog = (await (await insert('content/blog/hello.mdx', post)).json()) as any;
    expect(blog.url).toMatch(/^\/images\/blog\/hello\/shot-[0-9a-f]{8}\.webp$/);

    const res = await insert('../../shared/handbook/intro.mdx', handbook);
    expect(res.status).toBe(200);
    const external = (await res.json()) as any;
    expect(external.url).toMatch(/^\/images\/handbook\/intro\/shot-[0-9a-f]{8}\.webp$/);
    expect(await fs.readFile(path.join(shared, 'intro.mdx'), 'utf8')).toContain(
      `![Shot](${external.url})`,
    );
  });

  it('includes external pages in the library and in orphan checks', async () => {
    const { request, insert } = managerFor();
    const { url } = (await (
      await insert('../../shared/handbook/intro.mdx', handbook)
    ).json()) as any;

    const scan = (await (await request('/library')).json()) as any;
    expect(scan.pages.map((p: any) => p.file)).toContain('../../shared/handbook/intro.mdx');
    const image = scan.images.find((i: any) => i.url === url);
    expect(image.usages.map((u: any) => u.file)).toEqual(['../../shared/handbook/intro.mdx']);

    const del = (await (
      await request('/library/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls: [url] }),
      })
    ).json()) as any;
    expect(del.skipped.map((s: any) => s.reason)).toEqual(['Still used.']);
    expect(existsSync(path.join(app, 'public', url))).toBe(true);
  });
});

describe('mentions', () => {
  it('matches site paths only where they start a path', async () => {
    const { mentions } = await import('../src/fs');
    expect(mentions('![a](/images/a.png)', '/images/a.png')).toBe(true);
    expect(mentions(`src="/images/a.png"`, '/images/a.png')).toBe(true);
    expect(mentions(`import a from '../../public/images/a.png'`, '/images/a.png')).toBe(true);
    expect(mentions('![a](https://cdn.example.com/images/a.png)', '/images/a.png')).toBe(false);
    expect(mentions('see /images/a.png.bak', '/images/a.png')).toBe(true);
    expect(
      mentions(
        '![a](https://cdn.example.com/images/a.png)',
        'https://cdn.example.com/images/a.png',
      ),
    ).toBe(true);
  });
});
