import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_HEADER, createMediaManager, hashSource } from '../src';

const page = `---
title: Page
---

First paragraph.

<Callout>
  Inside callout.
</Callout>
`;

let root: string;
let manager: ReturnType<typeof createMediaManager>;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mmm-'));
  await fs.mkdir(path.join(root, 'content/docs'), { recursive: true });
  await fs.mkdir(path.join(root, 'public'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/docs/page.mdx'), page);
  manager = createMediaManager({ root });
});

afterEach(() => fs.rm(root, { recursive: true, force: true }));

const png = (width = 400, height = 200) =>
  sharp({ create: { width, height, channels: 3, background: '#f00' } })
    .png()
    .toBuffer();

async function read(file = 'content/docs/page.mdx') {
  return fs.readFile(path.join(root, file), 'utf8');
}

function request(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return manager.handler(
    new Request(`http://localhost:3000/__mdx-media${url}`, {
      ...init,
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        [CLIENT_HEADER]: '1',
        ...init.headers,
      },
    }),
  );
}

async function upload(endpoint: string, meta: object, image?: Buffer) {
  const form = new FormData();
  form.set(
    'file',
    new File([new Uint8Array(image ?? (await png()))], 'My Photo.PNG', { type: 'image/png' }),
  );
  form.set('meta', JSON.stringify(meta));
  return request(endpoint, { method: 'POST', body: form });
}

describe('insert', () => {
  it('writes a webp to the page folder, then edits the source', async () => {
    const res = await upload('/images/insert', {
      file: 'content/docs/page.mdx',
      hash: hashSource(page),
      target: { line: 8, column: 3, element: 'p' },
      position: 'after',
      alt: 'A photo',
      crop: { x: 0, y: 0, width: 100, height: 50 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.url).toMatch(/^\/images\/page\/my-photo-[0-9a-f]{8}\.webp$/);
    expect(body.hash).toBe(hashSource(await read()));
    expect(await read()).toContain(`  Inside callout.\n\n  ![A photo](${body.url})\n</Callout>`);

    const meta = await sharp(path.join(root, 'public', body.url)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 100, 50]);
  });

  it('rejects a stale hash with 409 and writes nothing', async () => {
    const res = await upload('/images/insert', {
      file: 'content/docs/page.mdx',
      hash: 'stale',
      target: { line: 5, column: 1 },
      position: 'after',
      alt: '',
    });
    expect(res.status).toBe(409);
    expect(await read()).toBe(page);
    expect(existsSync(path.join(root, 'public/images'))).toBe(false);
  });

  it('rejects files that are not images', async () => {
    const res = await upload(
      '/images/insert',
      {
        file: 'content/docs/page.mdx',
        hash: hashSource(page),
        target: { line: 5, column: 1 },
        position: 'after',
        alt: '',
      },
      Buffer.from('<svg onload="alert(1)"></svg>'),
    );
    expect(res.status).toBe(400);
    expect(await read()).toBe(page);
  });

  it('refuses paths outside the project', async () => {
    const res = await upload('/images/insert', {
      file: '../outside.mdx',
      hash: 'x',
      target: { line: 1, column: 1 },
      position: 'after',
      alt: '',
    });
    expect(res.status).toBe(400);
  });
});

describe('replace and delete', () => {
  async function insertOne() {
    const res = await upload('/images/insert', {
      file: 'content/docs/page.mdx',
      hash: hashSource(page),
      target: { line: 5, column: 1 },
      position: 'after',
      alt: 'Old',
    });
    return (await res.json()) as { url: string; hash: string };
  }

  it('replaces the image and removes the orphaned file', async () => {
    const first = await insertOne();
    const res = await upload(
      '/images/replace',
      {
        file: 'content/docs/page.mdx',
        hash: first.hash,
        image: { target: { line: 7, column: 1, element: 'p' }, url: first.url },
      },
      await png(300, 300),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.removed).toBe(first.url);
    expect(existsSync(path.join(root, 'public', first.url))).toBe(false);
    expect(await read()).toContain(`![Old](${body.url})`);
  });

  it('keeps a file that another page still uses', async () => {
    const first = await insertOne();
    await fs.writeFile(path.join(root, 'content/docs/other.mdx'), `![x](${first.url})\n`);
    const res = await request('/images/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        file: 'content/docs/page.mdx',
        hash: first.hash,
        image: { target: { line: 7, column: 1 }, url: first.url },
      }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).removed).toBeUndefined();
    expect(existsSync(path.join(root, 'public', first.url))).toBe(true);
    expect(await read()).toBe(page);
  });
});

describe('naming and update', () => {
  const json = (url: string, body: object) =>
    request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function insertNamed(name?: string) {
    const res = await upload('/images/insert', {
      file: 'content/docs/page.mdx',
      hash: hashSource(page),
      target: { line: 5, column: 1 },
      position: 'after',
      alt: 'Old',
      name,
    });
    return (await res.json()) as { url: string; hash: string };
  }

  it('uses the given name (slugified) for new images', async () => {
    const { url } = await insertNamed('Team Photo 2024!');
    expect(url).toMatch(/^\/images\/page\/team-photo-2024-[0-9a-f]{8}\.webp$/);
  });

  it('renames an image without re-encoding it and removes the old file', async () => {
    const first = await insertNamed();
    const before = await fs.readFile(path.join(root, 'public', first.url));
    const res = await json('/images/update', {
      file: 'content/docs/page.mdx',
      hash: first.hash,
      image: { target: { line: 7, column: 1 }, url: first.url },
      name: 'hero',
      alt: 'New alt',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.url).toMatch(/^\/images\/page\/hero-[0-9a-f]{8}\.webp$/);
    expect(body.removed).toBe(first.url);
    expect(await fs.readFile(path.join(root, 'public', body.url))).toEqual(before);
    expect(await read()).toContain(`![New alt](${body.url})`);
  });

  it('updates only the alt text when no name is given', async () => {
    const first = await insertNamed();
    const res = await json('/images/update', {
      file: 'content/docs/page.mdx',
      hash: first.hash,
      image: { target: { line: 7, column: 1 }, url: first.url },
      alt: 'Only alt',
    });
    const body = (await res.json()) as any;
    expect(body.url).toBe(first.url);
    expect(await read()).toContain(`![Only alt](${first.url})`);
  });

  it('keeps the old file when another page still uses it', async () => {
    const first = await insertNamed();
    await fs.writeFile(path.join(root, 'content/docs/other.mdx'), `![x](${first.url})\n`);
    const res = await json('/images/update', {
      file: 'content/docs/page.mdx',
      hash: first.hash,
      image: { target: { line: 7, column: 1 }, url: first.url },
      name: 'renamed',
    });
    const body = (await res.json()) as any;
    expect(body.removed).toBeUndefined();
    expect(existsSync(path.join(root, 'public', first.url))).toBe(true);
    expect(existsSync(path.join(root, 'public', body.url))).toBe(true);
  });

  it('never overwrites: same name + different image gives a second file', async () => {
    const first = await insertNamed('hero');
    const res = await upload(
      '/images/insert',
      {
        file: 'content/docs/page.mdx',
        hash: first.hash,
        target: { line: 5, column: 1 },
        position: 'after',
        alt: 'B',
        name: 'hero',
      },
      await png(300, 300),
    );
    const second = (await res.json()) as any;
    expect(second.url).not.toBe(first.url);
    expect(existsSync(path.join(root, 'public', first.url))).toBe(true);
    expect(existsSync(path.join(root, 'public', second.url))).toBe(true);
  });

  it('reuses the file when the same image gets the same name', async () => {
    const first = await insertNamed('hero');
    const res = await upload('/images/insert', {
      file: 'content/docs/page.mdx',
      hash: first.hash,
      target: { line: 5, column: 1 },
      position: 'after',
      alt: 'Again',
      name: 'hero',
    });
    expect(((await res.json()) as any).url).toBe(first.url);
    expect(await fs.readdir(path.join(root, 'public/images/page'))).toHaveLength(1);
  });

  it('renaming onto a name used by a different image keeps both files', async () => {
    const hero = await insertNamed('hero');
    const res = await upload(
      '/images/insert',
      {
        file: 'content/docs/page.mdx',
        hash: hero.hash,
        target: { line: 5, column: 1 },
        position: 'after',
        alt: 'Other',
        name: 'other',
      },
      await png(300, 300),
    );
    const other = (await res.json()) as any;
    const renamed = await json('/images/update', {
      file: 'content/docs/page.mdx',
      hash: other.hash,
      image: { target: { line: 7, column: 1 }, url: other.url },
      name: 'hero',
    });
    const body = (await renamed.json()) as any;
    expect(body.url).toMatch(/\/hero-[0-9a-f]{8}\.webp$/);
    expect(body.url).not.toBe(hero.url);
    expect(await fs.readFile(path.join(root, 'public', hero.url))).not.toEqual(
      await fs.readFile(path.join(root, 'public', body.url)),
    );
  });

  it('lists images that already use a name', async () => {
    const hero = await insertNamed('hero');
    const names = async (query: Record<string, string>) =>
      (
        (await (
          await request(
            `/images/names?${new URLSearchParams({ file: 'content/docs/page.mdx', ...query })}`,
          )
        ).json()) as any
      ).matches;
    expect(await names({ name: 'Hero' })).toEqual([hero.url]);
    expect(await names({ name: 'her' })).toEqual([]);
    expect(await names({ name: 'hero-banner' })).toEqual([]);
    // the image being renamed doesn't count as a clash with itself
    expect(await names({ name: 'hero', url: hero.url })).toEqual([]);
  });

  it('refuses to rename images outside the public folder', async () => {
    const src = `![Remote](https://example.com/a.png)\n`;
    await fs.writeFile(path.join(root, 'content/docs/page.mdx'), src);
    const res = await json('/images/update', {
      file: 'content/docs/page.mdx',
      hash: hashSource(src),
      image: { target: { line: 1, column: 1 }, url: 'https://example.com/a.png' },
      name: 'local',
    });
    expect(res.status).toBe(422);
  });
});

describe('security', () => {
  it('rejects cross-site origins', async () => {
    const res = await request('/status', { headers: { origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });

  it('rejects non-local hosts (DNS rebinding)', async () => {
    const res = await request('/status', {
      headers: { host: 'evil.example:3000', origin: 'http://evil.example:3000' },
    });
    expect(res.status).toBe(403);
  });

  it('requires the client header on writes', async () => {
    const res = await request('/images/delete', {
      method: 'POST',
      headers: { [CLIENT_HEADER]: '', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });

  it('serves status to the local page', async () => {
    const res = await request('/status');
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ok).toBe(true);
  });
});
