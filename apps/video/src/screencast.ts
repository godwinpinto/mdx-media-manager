import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';

interface Frame {
  file: string;
  /** Seconds, from Chrome's clock */
  time: number;
}

/**
 * Records a page with Chrome's screencast (full-quality JPEG frames, sent only when the page
 * changes) and encodes the frames to a constant-frame-rate MP4. Sharper than Playwright's
 * built-in video, which is low-bitrate VP8.
 */
export async function startScreencast(page: Page, dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const session = await page.context().newCDPSession(page);
  const frames: Frame[] = [];
  const writes: Promise<unknown>[] = [];
  let lastTime = 0;

  session.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    const time = metadata.timestamp ?? lastTime;
    lastTime = time;
    frames.push({ file, time });
    writes.push(fs.writeFile(file, Buffer.from(data, 'base64')));
    void session.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const { width, height } = page.viewportSize()!;
  await session.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    everyNthFrame: 1,
    maxWidth: width,
    maxHeight: height,
  });

  /** Chrome's clock, to mark scenes against the frame timestamps */
  const now = () =>
    page.evaluate(() => performance.timeOrigin + performance.now()).then((ms) => ms / 1000);

  return {
    now,
    async stop(output: string, fps = 30) {
      const end = await now();
      await session.send('Page.stopScreencast');
      await Promise.all(writes);
      if (frames.length === 0) throw new Error('No frames were captured.');
      // The concat demuxer shows each frame until the next one arrives.
      const lines = frames.flatMap((frame, i) => {
        const next = frames[i + 1]?.time ?? end;
        return [
          `file '${frame.file}'`,
          `duration ${Math.max(0.001, next - frame.time).toFixed(4)}`,
        ];
      });
      lines.push(`file '${frames.at(-1)!.file}'`);
      const list = path.join(dir, 'frames.txt');
      await fs.writeFile(list, lines.join('\n'));
      await ffmpeg([
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        list,
        // Explicit BT.709 conversion and tags: untagged H.264 makes QuickTime and others guess,
        // which shifts colours and gamma.
        '-vf',
        `fps=${fps},scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p`,
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        '16',
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
        // The concat demuxer holds the repeated last frame too long; end where the capture did
        '-t',
        (end - frames[0]!.time).toFixed(3),
        '-movflags',
        '+faststart',
        output,
      ]);
      return { frames: frames.length, start: frames[0]!.time, end };
    },
  };
}

export function ffmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)),
    );
  });
}
