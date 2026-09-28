/**
 * Renders the film frame by frame: seeks the timeline to each frame's time in headless Chrome,
 * screenshots it as PNG (lossless RGB) and pipes the frames into ffmpeg.
 *
 *   pnpm render                         → out/promo.mp4 (1920×1080, 60 fps)
 *   pnpm render --stills 1,4.5,12       → out/stills/*.png at those seconds
 *   pnpm render --fps 30 --from 20 --to 30
 *   pnpm render --speed 1.5             → out/promo-1.5x.mp4
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'out');

const { values } = parseArgs({
  options: {
    fps: { type: 'string', default: '60' },
    from: { type: 'string' },
    to: { type: 'string' },
    out: { type: 'string' },
    speed: { type: 'string' },
    stills: { type: 'string' },
  },
});

// Default name: promo.mp4, or promo-1.5x.mp4 for another speed
values.out ??= path.join(outDir, values.speed ? `promo-${Number(values.speed)}x.mp4` : 'promo.mp4');

const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 0, strictPort: false },
});
await server.listen();
const url = server.resolvedUrls!.local[0]!;
const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => console.error('page error:', error.message));
  await page.goto(`${url}?render${values.speed ? `&speed=${values.speed}` : ''}`);
  await page.waitForFunction(() => window.__film, undefined, { timeout: 30_000 });
  const duration = await page.evaluate(() => window.__film!.duration);
  const seek = (ms: number) => page.evaluate((t) => window.__film!.seek(t), ms);

  if (values.stills) {
    const dir = path.join(outDir, 'stills');
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    for (const s of values.stills.split(',').map(Number)) {
      await seek(s * 1000);
      await page.screenshot({ path: path.join(dir, `${s.toFixed(2).padStart(6, '0')}.png`) });
    }
    console.log(
      `${values.stills.split(',').length} stills in ${dir} (film is ${(duration / 1000).toFixed(2)}s)`,
    );
  } else {
    const fps = Number(values.fps);
    const start = Number(values.from ?? 0) * 1000;
    const end = Math.min(duration, Number(values.to ?? Infinity) * 1000);
    const frames = Math.round(((end - start) / 1000) * fps);
    await fs.mkdir(path.dirname(values.out!), { recursive: true });

    // RGB PNG in, BT.709 out, tagged in both the container and the H.264 stream so QuickTime
    // and browsers agree on the colours.
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'image2pipe',
        '-framerate',
        String(fps),
        '-c:v',
        'png',
        '-i',
        '-',
        '-vf',
        'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        '14',
        '-tune',
        'animation',
        '-colorspace',
        'bt709',
        '-color_primaries',
        'bt709',
        '-color_trc',
        'bt709',
        '-color_range',
        'tv',
        '-x264-params',
        'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv',
        '-movflags',
        '+faststart',
        values.out!,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const done = new Promise<void>((resolve, reject) => {
      ffmpeg.on('error', reject);
      ffmpeg.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)),
      );
    });

    const began = Date.now();
    for (let i = 0; i < frames; i++) {
      await seek(start + (i * 1000) / fps);
      const png = await page.screenshot({ type: 'png' });
      if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
      if (i % fps === 0)
        process.stdout.write(
          `\r${Math.round((i / frames) * 100)}%  ${(i / fps).toFixed(0)}s of ${((end - start) / 1000).toFixed(0)}s`,
        );
    }
    ffmpeg.stdin.end();
    await done;
    console.log(
      `\n${values.out}: ${frames} frames at ${fps} fps in ${((Date.now() - began) / 1000).toFixed(0)}s`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
