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
