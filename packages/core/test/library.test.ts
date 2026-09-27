import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_HEADER, createMediaManager, defaultPageUrl, hashSource } from '../src';

let root: string;
let manager: ReturnType<typeof createMediaManager>;

const shared = '/images/shared/diagram-11111111.png';
const unused = '/images/shared/old-22222222.png';
const codeOnly = '/images/shared/logo-33333333.png';

const pageA = `---
title: A
---

![Diagram](${shared})

![](/images/missing.png)
`;
const pageB = `# B

<Callout>
  <img src="${shared}" />
</Callout>
`;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mmm-lib-'));
  await fs.mkdir(path.join(root, 'content/docs/guide'), { recursive: true });
  await fs.mkdir(path.join(root, 'public/images/shared'), { recursive: true });
  await fs.mkdir(path.join(root, 'app'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/docs/index.mdx'), pageA);
  await fs.writeFile(path.join(root, 'content/docs/guide/b.mdx'), pageB);
  await fs.writeFile(path.join(root, 'app/page.tsx'), `export const logo = '${codeOnly}';\n`);
  const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#00f' } })
    .png()
    .toBuffer();
  for (const url of [shared, unused, codeOnly])
    await fs.writeFile(path.join(root, 'public', url), png);
  manager = createMediaManager({ root });
});

afterEach(() => fs.rm(root, { recursive: true, force: true }));

function request(url: string, body?: object) {
  return manager.handler(
    new Request(`http://localhost:3000/__mdx-media${url}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        host: 'localhost:3000',
        [CLIENT_HEADER]: '1',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

const scan = async () => (await (await request('/library')).json()) as any;
const read = (file: string) => fs.readFile(path.join(root, file), 'utf8');

describe('scan', () => {
  it('lists images with where they are used', async () => {
    const result = await scan();
    const byUrl = Object.fromEntries(result.images.map((image: any) => [image.url, image]));

    expect(byUrl[shared]).toMatchObject({
      name: 'diagram-11111111.png',
      width: 20,
      height: 10,
      format: 'png',
      managed: true,
    });
    expect(
      byUrl[shared].usages.map((u: any) => [u.file, u.line, u.element, u.alt, u.pageUrl]),
    ).toEqual([
      ['content/docs/guide/b.mdx', 4, 'img', '', '/docs/guide/b'],
      ['content/docs/index.mdx', 5, 'markdown', 'Diagram', '/docs'],
    ]);
    expect(byUrl[unused].usages).toEqual([]);
    expect(byUrl[unused].mentions).toEqual([]);
    expect(byUrl[codeOnly].mentions).toEqual(['app/page.tsx']);
  });

  it('reports broken references and pages', async () => {
    const result = await scan();
    expect(result.broken.map((b: any) => [b.url, b.file, b.line])).toEqual([
      ['/images/missing.png', 'content/docs/index.mdx', 7],
    ]);
    expect(result.pages.map((p: any) => p.pageUrl)).toEqual(['/docs/guide/b', '/docs']);
  });

  it('maps content files to page URLs', () => {
    expect(defaultPageUrl('content/docs/index.mdx')).toBe('/docs');
    expect(defaultPageUrl('content/docs/a/index.md')).toBe('/docs/a');
    expect(defaultPageUrl('content/blog/post.mdx')).toBe('/blog/post');
    expect(defaultPageUrl('docs/x.mdx')).toBeUndefined();
  });
});

describe('site-wide changes', () => {
  it('renames an image on every page and removes the old file', async () => {
    const res = await request('/library/rename', { url: shared, name: 'Architecture' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.url).toMatch(/^\/images\/shared\/architecture-[0-9a-f]{8}\.png$/);
    expect(body.updated.sort()).toEqual(['content/docs/guide/b.mdx', 'content/docs/index.mdx']);
    expect(body.removed).toBe(shared);
    expect(await read('content/docs/index.mdx')).toContain(`![Diagram](${body.url})`);
    expect(await read('content/docs/guide/b.mdx')).toContain(`<img src="${body.url}" />`);
    expect(existsSync(path.join(root, 'public', shared))).toBe(false);
  });

  it('keeps the old file when code still mentions it', async () => {
    await fs.writeFile(path.join(root, 'app/extra.tsx'), `export const x = '${shared}';\n`);
    const body = (await (
      await request('/library/rename', { url: shared, name: 'renamed' })
    ).json()) as any;
    expect(body.removed).toBeUndefined();
    expect(body.kept).toEqual(['app/extra.tsx']);
    expect(existsSync(path.join(root, 'public', shared))).toBe(true);
  });

  it('refuses to rename images used only in code', async () => {
    const res = await request('/library/rename', { url: codeOnly, name: 'brand' });
    expect(res.status).toBe(422);
    expect(await fs.readdir(path.join(root, 'public/images/shared'))).toHaveLength(3);
  });

  it('sets alt text everywhere, adding it to JSX images that had none', async () => {
    const body = (await (
      await request('/library/alt', { url: shared, alt: 'System "diagram"' })
    ).json()) as any;
    expect(body.updated).toHaveLength(2);
    expect(await read('content/docs/index.mdx')).toContain(`![System "diagram"](${shared})`);
    expect(await read('content/docs/guide/b.mdx')).toContain(
      `<img src="${shared}" alt="System diagram" />`,
    );
  });

  it('deletes only unused images', async () => {
    const body = (await (
      await request('/library/delete', { urls: [unused, shared, codeOnly] })
    ).json()) as any;
    expect(body.deleted).toEqual([unused]);
    expect(body.skipped.map((s: any) => s.url)).toEqual([shared, codeOnly]);
    expect(existsSync(path.join(root, 'public', unused))).toBe(false);
  });
});

describe('insert existing', () => {
  it('places a library image without uploading', async () => {
    const res = await request('/images/insert-existing', {
      file: 'content/docs/guide/b.mdx',
      hash: hashSource(pageB),
      target: { line: 1, column: 1, element: 'h1' },
      position: 'after',
      alt: 'Reused',
      url: unused,
    });
    expect(res.status).toBe(200);
    expect(await read('content/docs/guide/b.mdx')).toContain(
      `# B\n\n![Reused](${unused})\n\n<Callout>`,
    );
  });

  it('rejects images that do not exist', async () => {
    const res = await request('/images/insert-existing', {
      file: 'content/docs/guide/b.mdx',
      hash: hashSource(pageB),
      target: { line: 1, column: 1 },
      position: 'after',
      alt: 'x',
      url: '/images/nope.png',
    });
    expect(res.status).toBe(404);
  });
});
