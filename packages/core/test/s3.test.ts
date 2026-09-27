import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import S3rver from 's3rver';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CLIENT_HEADER,
  createMediaManager,
  hashSource,
  resolveS3Options,
  s3OptionsFromEnv,
} from '../src';

const CDN = 'https://cdn.example.com';
const page = `# Page\n\nIntro.\n`;

let server: S3rver;
let endpoint: string;
let s3: S3Client;
let root: string;
let bucket: string;
let manager: ReturnType<typeof createMediaManager>;
let bucketCount = 0;

beforeAll(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mmm-s3rver-'));
  server = new S3rver({ port: 0, address: '127.0.0.1', silent: true, directory });
  const { port } = await server.run();
  endpoint = `http://127.0.0.1:${port}`;
  s3 = new S3Client({
    endpoint,
    region: 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId: 'S3RVER', secretAccessKey: 'S3RVER' },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
});

afterAll(() => server.close());

beforeEach(async () => {
  bucket = `docs-${++bucketCount}`;
  await server.reset?.();
  const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));

  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mmm-s3-'));
  await fs.mkdir(path.join(root, 'content/docs'), { recursive: true });
  await fs.mkdir(path.join(root, 'public/images/docs/page'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/docs/page.mdx'), page);
  manager = createMediaManager({
    root,
    s3: {
      bucket,
      endpoint,
      cdnUrl: CDN,
      accessKeyId: 'S3RVER',
      secretAccessKey: 'S3RVER',
      forcePathStyle: true,
    },
  });
});

afterEach(() => fs.rm(root, { recursive: true, force: true }));

const png = (width = 40, height = 20, background = '#f00') =>
  sharp({ create: { width, height, channels: 3, background } })
    .png()
    .toBuffer();

const read = (file = 'content/docs/page.mdx') => fs.readFile(path.join(root, file), 'utf8');
const keyOf = (url: string) => url.slice(CDN.length + 1);
const head = (key: string) =>
  s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(
    (res) => res,
    () => undefined,
  );

function request(url: string, init: RequestInit = {}) {
  return manager.handler(
    new Request(`http://localhost:3000/__mdx-media${url}`, {
      ...init,
      headers: { host: 'localhost:3000', [CLIENT_HEADER]: '1', ...(init.headers as object) },
    }),
  );
}
const json = (url: string, body: object) =>
  request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

async function insert(source = page, image?: Buffer, name?: string) {
  const form = new FormData();
  form.set(
    'file',
    new File([new Uint8Array(image ?? (await png()))], 'Shot.png', { type: 'image/png' }),
  );
  form.set(
    'meta',
    JSON.stringify({
      file: 'content/docs/page.mdx',
      hash: hashSource(source),
      target: { line: 3, column: 1 },
      position: 'after',
      alt: 'Shot',
      name,
    }),
  );
  const res = await request('/images/insert', { method: 'POST', body: form });
  expect(res.status).toBe(200);
  return (await res.json()) as { url: string; hash: string };
}

describe('configuration', () => {
  it('reads MDX_MEDIA_* variables', () => {
    expect(
      s3OptionsFromEnv({
        MDX_MEDIA_S3_BUCKET: 'b',
        MDX_MEDIA_CDN_URL: 'https://images.example.com/',
        MDX_MEDIA_S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
      }),
    ).toMatchObject({
      bucket: 'b',
      cdnUrl: 'https://images.example.com/',
      endpoint: 'https://acc.r2.cloudflarestorage.com',
    });
    expect(s3OptionsFromEnv({})).toBeUndefined();
    expect(() => s3OptionsFromEnv({ MDX_MEDIA_S3_BUCKET: 'b' })).toThrow(/MDX_MEDIA_CDN_URL/);
  });

  it('defaults region to auto for custom endpoints (R2) and trims the CDN URL', () => {
    expect(
      resolveS3Options({ bucket: 'b', cdnUrl: 'https://x.com/', endpoint: 'https://r2' }),
    ).toMatchObject({
      region: 'auto',
      cdnUrl: 'https://x.com',
      prefix: 'images',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    expect(resolveS3Options({ bucket: 'b', cdnUrl: 'https://x.com' }).region).toBe('us-east-1');
  });

  it('reports the storage in use', async () => {
    const status = (await (await request('/status')).json()) as any;
    expect(status).toMatchObject({ storage: 's3', cdnUrl: CDN });
  });
});

describe('editing with S3', () => {
  it('uploads to the bucket and writes the CDN URL into the page', async () => {
    const { url } = await insert();
    expect(url).toMatch(
      /^https:\/\/cdn\.example\.com\/images\/docs\/page\/shot-[0-9a-f]{8}\.webp$/,
    );
    expect(await read()).toContain(`![Shot](${url})`);
    const object = await head(keyOf(url));
    expect(object).toMatchObject({
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(await fs.readdir(path.join(root, 'public/images/docs/page'))).toEqual([]);
  });

  it('replaces: uploads the new image and deletes the unused old object', async () => {
    const first = await insert();
    const form = new FormData();
    form.set(
      'file',
      new File([new Uint8Array(await png(30, 30, '#00f'))], 'New.png', { type: 'image/png' }),
    );
    form.set(
      'meta',
      JSON.stringify({
        file: 'content/docs/page.mdx',
        hash: first.hash,
        image: { target: { line: 5, column: 1 }, url: first.url },
      }),
    );
    const body = (await (
      await request('/images/replace', { method: 'POST', body: form })
    ).json()) as any;
    expect(body.removed).toBe(first.url);
    expect(await head(keyOf(first.url))).toBeUndefined();
    expect(await head(keyOf(body.url))).toBeDefined();
  });

  it('renames by copying within the bucket', async () => {
    const first = await insert();
    const body = (await (
      await json('/images/update', {
        file: 'content/docs/page.mdx',
        hash: first.hash,
        image: { target: { line: 5, column: 1 }, url: first.url },
        name: 'Hero Banner',
      })
    ).json()) as any;
    const hash = first.url.match(/-([0-9a-f]{8})\.webp$/)![1];
    expect(body.url).toBe(`${CDN}/images/docs/page/hero-banner-${hash}.webp`);
    expect(body.removed).toBe(first.url);
    expect(await head(keyOf(body.url))).toBeDefined();
    expect(await read()).toContain(`![Shot](${body.url})`);
  });

  it('keeps an object another page still uses, and deletes it when the last use goes', async () => {
    const first = await insert();
    await fs.writeFile(path.join(root, 'content/docs/other.mdx'), `![x](${first.url})\n`);
    const del = (await (
      await json('/images/delete', {
        file: 'content/docs/page.mdx',
        hash: first.hash,
        image: { target: { line: 5, column: 1 }, url: first.url },
      })
    ).json()) as any;
    expect(del.removed).toBeUndefined();
    expect(await head(keyOf(first.url))).toBeDefined();

    const other = `![x](${first.url})\n`;
    const last = (await (
      await json('/images/delete', {
        file: 'content/docs/other.mdx',
        hash: hashSource(other),
        image: { target: { line: 1, column: 1 }, url: first.url },
      })
    ).json()) as any;
    expect(last.removed).toBe(first.url);
    expect(await head(keyOf(first.url))).toBeUndefined();
  });

  it('serves original bytes for the editor', async () => {
    const { url } = await insert();
    const res = await request(`/images/source?url=${encodeURIComponent(url)}`);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).format).toBe('webp');
    expect(
      (await request(`/images/source?url=${encodeURIComponent(`${CDN}/images/nope.webp`)}`)).status,
    ).toBe(404);
    expect(
      (await request(`/images/source?url=${encodeURIComponent('https://evil.example/x.png')}`))
        .status,
    ).toBe(404);
  });

  it('finds look-alike names in the bucket folder', async () => {
    const { url } = await insert(page, undefined, 'hero');
    const res = (await (
      await request(`/images/names?file=content/docs/page.mdx&name=Hero`)
    ).json()) as any;
    expect(res.matches).toEqual([url]);
  });
});

describe('library with S3', () => {
  it('lists referenced bucket images with size and usages, and flags missing objects', async () => {
    const { url } = await insert();
    const text = await read();
    await fs.writeFile(
      path.join(root, 'content/docs/page.mdx'),
      `${text}\n![Gone](${CDN}/images/docs/page/gone-00000000.webp)\n`,
    );
    const scan = (await (await request('/library')).json()) as any;
    const image = scan.images.find((i: any) => i.url === url);
    expect(image).toMatchObject({
      storage: 's3',
      managed: true,
      width: 40,
      height: 20,
      format: 'webp',
      label: expect.stringMatching(/^docs\/page\/shot-/),
    });
    expect(image.usages.map((u: any) => u.file)).toEqual(['content/docs/page.mdx']);
    expect(scan.broken.map((b: any) => b.url)).toEqual([
      `${CDN}/images/docs/page/gone-00000000.webp`,
    ]);
  });

  it('moves local images to S3 and rewrites every page', async () => {
    const local = '/images/docs/page/local-11111111.png';
    await fs.writeFile(path.join(root, 'public', local), await png());
    const withLocal = `${page}\n![Local](${local})\n`;
    await fs.writeFile(path.join(root, 'content/docs/page.mdx'), withLocal);
    await fs.writeFile(
      path.join(root, 'content/docs/other.mdx'),
      `<img src="${local}" alt="Local" />\n`,
    );

    const body = (await (await json('/library/move-to-s3', { urls: [local] })).json()) as any;
    const to = `${CDN}/images/docs/page/local-11111111.png`;
    expect(body.moved).toEqual([
      expect.objectContaining({ from: local, to, removed: local, kept: [] }),
    ]);
    expect(body.moved[0].updated.sort()).toEqual([
      'content/docs/other.mdx',
      'content/docs/page.mdx',
    ]);
    expect(await read()).toContain(`![Local](${to})`);
    expect(await read('content/docs/other.mdx')).toContain(`<img src="${to}" alt="Local" />`);
    expect(existsSync(path.join(root, 'public', local))).toBe(false);

    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: 'images/docs/page/local-11111111.png' }),
    );
    expect(object.ContentType).toBe('image/png');
  });

  it('keeps the local file when code still mentions it', async () => {
    const local = '/images/logo.png';
    await fs.writeFile(path.join(root, 'public', local), await png());
    await fs.writeFile(path.join(root, 'content/docs/page.mdx'), `${page}\n![Logo](${local})\n`);
    await fs.mkdir(path.join(root, 'app'), { recursive: true });
    await fs.writeFile(path.join(root, 'app/header.tsx'), `export const logo = '${local}';\n`);

    const body = (await (await json('/library/move-to-s3', { urls: [local] })).json()) as any;
    expect(body.moved[0]).toMatchObject({ to: `${CDN}/images/logo.png`, kept: ['app/header.tsx'] });
    expect(body.moved[0].removed).toBeUndefined();
    expect(existsSync(path.join(root, 'public', local))).toBe(true);
  });

  it('renames a bucket image on every page', async () => {
    const { url } = await insert();
    await fs.writeFile(path.join(root, 'content/docs/other.mdx'), `![x](${url})\n`);
    const body = (await (await json('/library/rename', { url, name: 'diagram' })).json()) as any;
    expect(body.url).toMatch(/\/images\/docs\/page\/diagram-[0-9a-f]{8}\.webp$/);
    expect(body.updated.sort()).toEqual(['content/docs/other.mdx', 'content/docs/page.mdx']);
    expect(await head(keyOf(url))).toBeUndefined();
  });

  it('refuses to move without S3 configured', async () => {
    manager = createMediaManager({ root, s3: false });
    const res = await json('/library/move-to-s3', { urls: ['/images/x.png'] });
    expect(res.status).toBe(422);
  });

  it('ignores objects outside the CDN URL it serves', async () => {
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: 'images/other.png', Body: await png() }),
    );
    const scan = (await (await request('/library')).json()) as any;
    expect(scan.images).toEqual([]);
  });
});
