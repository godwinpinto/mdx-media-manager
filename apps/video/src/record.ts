/**
 * Records the ~30s teaser: title scenes plus a live run of the overlay on the docs site.
 *
 * Needs the docs dev server (`pnpm --filter docs dev`, port 3002). Seeds a few images for the
 * library, drives the real overlay, then restores `apps/docs/content` and removes the images it
 * created. Output: `apps/video/out/teaser.mp4`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Frame, type Locator, type Page } from 'playwright';
import sharp from 'sharp';
import { startScreencast } from './screencast.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = process.env.SITE_URL ?? 'http://localhost:3002';
const docsApp = path.resolve(here, '../../docs');
const imagesDir = path.join(docsApp, 'public/images');
const outDir = path.resolve(here, '../out');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const git = (...args: string[]) => execFileSync('git', args, { cwd: docsApp, encoding: 'utf8' });

declare global {
  interface Window {
    stage: Record<string, (...args: any[]) => any>;
  }
}

// ---------------------------------------------------------------------------------------------
// Pointer: a drawn cursor that follows eased, human-like moves

const ZOOM = 1.5;
let pointer = { x: 1350, y: 780 };

async function glide(page: Page, x: number, y: number, ms = 650) {
  const from = { ...pointer };
  const start = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / ms);
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    pointer = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
    await page.mouse.move(pointer.x, pointer.y);
    await page.evaluate(([px, py]) => window.stage.cursor(px, py), [pointer.x, pointer.y]);
    if (t === 1) break;
    await sleep(8);
  }
}

async function center(locator: Locator, fy = 0.5) {
  await locator.waitFor({ state: 'visible' });
  // Controls below the fold (the dialog is taller than the frame): scroll like a person would
  const scrolled = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= innerHeight) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  });
  if (scrolled) await sleep(550);
  // Playwright reports boxes in unzoomed CSS pixels; the stage is zoomed (see stage.html)
  const box = (await locator.boundingBox())!;
  return { x: (box.x + box.width / 2) * ZOOM, y: (box.y + box.height * fy) * ZOOM };
}

async function click(page: Page, locator: Locator, ms = 600) {
  const { x, y } = await center(locator);
  await glide(page, x, y, ms);
  await sleep(90);
  await page.evaluate(([px, py]) => window.stage.click(px, py), [x, y]);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
}

async function drag(page: Page, locator: Locator, dx: number, dy: number, ms = 700) {
  const { x, y } = await center(locator);
  await glide(page, x, y, 450);
  await page.mouse.down();
  await glide(page, x + dx, y + dy, ms);
  await page.mouse.up();
}

// ---------------------------------------------------------------------------------------------
// Content

const prompt = 'Write the installation guide for our docs';

async function mdxLines() {
  const source = await fs.readFile(path.join(docsApp, 'content/docs/installation.mdx'), 'utf8');
  return source.split('\n').slice(0, 22);
}

const hashOf = (data: Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 8);

async function screenshot(page: Page, url: string, scheme: 'dark' | 'light') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.addStyleTag({
    content: 'nextjs-portal, mdx-media-manager { display: none !important; }',
  });
  await sleep(300);
  return page.screenshot();
}

/** Library content: two images in use (one without alt text) and one no page uses. */
async function seed(page: Page) {
  const seeds = [
    {
      page: 'installation',
      name: 'init-output',
      alt: 'Output of the init command',
      url: '/docs/installation',
    },
    { page: 's3', name: 'bucket-settings', alt: '', url: '/docs/s3' },
    { page: undefined, name: 'old-diagram', alt: '', url: '/docs/how-it-works' },
  ];
  for (const s of seeds) {
    const data = await sharp(await screenshot(page, site + s.url, 'light'))
      .resize({ width: 1200 })
      .webp({ quality: 80 })
      .toBuffer();
    const folder = s.page ? `docs/${s.page}` : 'docs';
    const file = `${s.name}-${hashOf(data)}.webp`;
    await fs.mkdir(path.join(imagesDir, folder), { recursive: true });
    await fs.writeFile(path.join(imagesDir, folder, file), data);
    if (s.page) {
      const mdx = path.join(docsApp, `content/docs/${s.page}.mdx`);
      await fs.appendFile(mdx, `\n![${s.alt}](/images/${folder}/${file})\n`);
    }
  }
}

/** `git status` and the MDX diff after the insert, as the git scene shows them */
function gitSummary(mdx: string, image: string) {
  const status = git('status', '--short', '--untracked-files=all', '--', mdx, image).trimEnd();
  const diff = git('diff', '--relative', '-U1', '--', mdx)
    .split('\n')
    .filter((line) => !/^(diff --git|index |--- |\+\+\+ )/.test(line))
    .join('\n')
    .trimEnd();
  const esc = (s: string) =>
    s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const color = (line: string) =>
    line.startsWith('+')
      ? `<span class="add">${esc(line)}</span>`
      : line.startsWith('??')
        ? `<span class="new">${esc(line)}</span>`
        : line.startsWith('@@')
          ? `<span class="d">${esc(line)}</span>`
          : esc(line);
  return [
    `<span class="p">$</span> git status --short`,
    ...status.split('\n').map(color),
    '',
    `<span class="p">$</span> git diff ${esc(mdx)}`,
    ...diff.split('\n').map(color),
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------

let failed: Page | undefined;

async function main() {
  if (git('status', '--porcelain', '--', 'content').trim()) {
    throw new Error('apps/docs/content has uncommitted changes; commit or stash them first.');
  }
  const hadImages = existsSync(imagesDir);
  if (hadImages) throw new Error('apps/docs/public/images already exists; move it away first.');

  const browser = await chromium.launch();
  // Ctrl+C still restores the docs content
  process.once('SIGINT', () => void browser.close());
  const context = await browser.newContext({
    // The stage zooms itself 1.5× to fill this: Chrome's screencast ignores deviceScaleFactor
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'light',
  });

  try {
    // Pictures to paste: the docs home page, light then dark
    const shooter = await context.newPage();
    await shooter.setViewportSize({ width: 1440, height: 900 });
    const pasteA = await screenshot(shooter, `${site}/`, 'light');
    const pasteB = await screenshot(shooter, `${site}/`, 'dark');
    await seed(shooter);
    await shooter.close();

    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    failed = page;
    // Served from the site's origin: Chrome won't let a public origin frame localhost.
    const stageUrl = `${site}/__video-stage`;
    await page.route(stageUrl, (route) =>
      route.fulfill({ path: path.join(here, 'stage.html'), contentType: 'text/html' }),
    );
    await page.goto(stageUrl);
    await page.evaluate((url) => {
      (document.querySelector('#site') as HTMLIFrameElement).src = url;
    }, `${site}/docs`);
    const siteFrame = page.frameLocator('#site');
    const frame = await waitForFrame(page);
    await frame.waitForLoadState('networkidle');
    await frame.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    const overlay = siteFrame.locator('mdx-media-manager');
    await overlay.locator('.dock .toggle.on').waitFor();
    const lines = await mdxLines();

    await fs.mkdir(outDir, { recursive: true });
    const cast = await startScreencast(page, path.join(outDir, 'frames'));
    const stage = <T extends unknown[]>(fn: string, ...args: T) =>
      page.evaluate(([name, rest]) => window.stage[name as string]!(...(rest as unknown[])), [
        fn,
        args,
      ] as const);

    // 1. Hook
    await sleep(200);
    await stage('scene', 'hook');
    await sleep(450);
    await stage('type', prompt, 30);
    await sleep(150);
    await stage('stream', lines, 38);
    await sleep(700);

    // 2. The manual routine
    await stage('scene', 'problem');
    await sleep(400);
    await stage('steps', 330);
    await sleep(650);

    // 3. Name
    await stage('scene', 'reveal');
    await sleep(1300);

    // 4. Insert
    await stage('scene', 'demo');
    await stage('caption', 'Hover any block to <em>add an image</em>');
    await sleep(350);
    const paragraph = siteFrame.locator('p[data-mmm]').first();
    const target = await center(paragraph, 0.8);
    pointer = { x: target.x + 120, y: target.y + 160 };
    await glide(page, target.x, target.y, 700);
    await sleep(350);
    await click(page, overlay.locator('.insert-button'), 450);
    const dialog = overlay.locator('.dialog');
    await dialog.waitFor();
    await stage('caption', 'Paste a screenshot');
    await sleep(350);
    await stage('keys', '⌘ V');
    await paste(frame, pasteA);
    await sleep(350);
    await stage('keys', '');
    await stage('caption', 'Crop, compress and rename, <em>without leaving your site</em>');
    await sleep(300);
    await drag(page, dialog.locator('.ReactCrop__drag-handle.ord-se'), -60, -40, 550);
    await sleep(200);
    // Quality slider (40–100): from 82 down to about 70
    const slider = dialog.locator('input[type="range"]');
    const track = await center(slider);
    const box = (await slider.boundingBox())!;
    const width = box.width * ZOOM;
    const left = track.x - width / 2;
    await glide(page, left + width * 0.7, track.y, 500);
    await page.mouse.down();
    await glide(page, left + width * 0.5, track.y, 600);
    await page.mouse.up();
    await sleep(250);
    const alt = dialog.locator('input[placeholder="Describe the image"]');
    await click(page, alt, 450);
    await page.keyboard.type('The docs home page', { delay: 28 });
    const name = dialog.locator('input[aria-describedby="mmm-name-help"]');
    await click(page, name, 350);
    await page.keyboard.press('ControlOrMeta+a');
    await sleep(150);
    await page.keyboard.type('docs-home', { delay: 30 });
    await sleep(200);
    await click(page, dialog.getByRole('button', { name: 'Insert' }), 450);
    const inserted = siteFrame.locator('img[data-mmm-img*="docs-home"]');
    await inserted.waitFor({ state: 'visible', timeout: 20_000 });
    await stage('caption', 'Saved to <em>public/</em> and written into your MDX');
    const file = (await inserted.getAttribute('data-mmm-img'))!;
    const gitHtml = gitSummary('content/docs/index.mdx', path.posix.join('public', file));
    await glide(page, pointer.x + 60, pointer.y - 30, 500);
    await sleep(800);

    // 5. Replace
    await stage('caption', '<em>Replace</em> it…');
    const image = await center(inserted, 0.4);
    await glide(page, image.x, image.y, 500);
    await click(page, overlay.locator('.toolbar button', { hasText: 'Edit' }), 400);
    await dialog.waitFor();
    await sleep(250);
    await stage('keys', '⌘ V');
    await paste(frame, pasteB);
    await sleep(300);
    await stage('keys', '');
    await click(page, dialog.getByRole('button', { name: 'Save' }), 500);
    await dialog.waitFor({ state: 'detached', timeout: 20_000 });
    await siteFrame.locator('img[data-mmm-img*="docs-home"]').waitFor({ state: 'visible' });
    await sleep(700);

    // 6. Delete
    await stage('caption', '…or <em>delete</em> it, right on the page');
    const replaced = await center(siteFrame.locator('img[data-mmm-img*="docs-home"]'), 0.5);
    await glide(page, replaced.x - 40, replaced.y, 350);
    await click(page, overlay.locator('.toolbar button', { hasText: 'Delete' }), 400);
    await sleep(250);
    await click(page, overlay.locator('.toolbar button', { hasText: 'Confirm delete' }), 150);
    await siteFrame
      .locator('img[data-mmm-img*="docs-home"]')
      .waitFor({ state: 'detached', timeout: 20_000 });
    await sleep(600);

    // 7. Library
    await stage('caption', 'Find <em>unused</em> images and <em>missing alt</em> text');
    await click(page, overlay.locator('.library-button'), 650);
    const library = overlay.locator('.library');
    await library.locator('.card').first().waitFor({ timeout: 20_000 });
    await sleep(400);
    await click(page, library.getByRole('tab', { name: /Missing alt/ }), 550);
    await sleep(700);
    await click(page, library.getByRole('tab', { name: /Unused/ }), 450);
    await sleep(900);

    // 8. Git
    await stage('hideCursor');
    await stage('git', gitHtml);
    await stage('scene', 'git');
    await sleep(2400);

    // 9. Development only
    await stage('scene', 'dev');
    await sleep(3000);

    // 10. Outro
    await stage('scene', 'outro');
    await sleep(2600);

    const output = path.join(outDir, 'teaser.mp4');
    const result = await cast.stop(output);
    console.log(`${output}: ${(result.end - result.start).toFixed(1)}s, ${result.frames} frames`);
  } catch (error) {
    await failed?.screenshot({ path: path.join(outDir, 'error.png') }).catch(() => {});
    for (const f of failed?.frames() ?? [])
      console.error(
        f.url(),
        await f
          .evaluate(() =>
            [...document.querySelectorAll('img[data-mmm-img]')].map((i) =>
              i.getAttribute('data-mmm-img'),
            ),
          )
          .catch(String),
      );
    console.error(git('diff', '--', 'content'));
    throw error;
  } finally {
    await browser.close();
    git('checkout', '--', 'content');
    await fs.rm(imagesDir, { recursive: true, force: true });
    if (!process.env.KEEP_FRAMES)
      await fs.rm(path.join(outDir, 'frames'), { recursive: true, force: true });
  }
}

async function waitForFrame(page: Page): Promise<Frame> {
  for (const start = Date.now(); Date.now() - start < 30_000;) {
    const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(site));
    if (frame) return frame;
    await sleep(50);
  }
  throw new Error('The docs page did not load in the frame.');
}

/** Paste an image the way a screenshot arrives from the clipboard */
async function paste(frame: Frame, png: Buffer) {
  await frame.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  }, png.toString('base64'));
}

await main();
