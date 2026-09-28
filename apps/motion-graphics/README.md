# motion-graphics

The ~64 second promo film for mdx-media-manager, built from mock UI (skeletons, a mock browser,
dialog, library and code panel) animated with [anime.js](https://animejs.com) v4, not from
screen recordings. Light mode, 1920×1080, 60 fps.

```bash
pnpm --filter motion-graphics dev      # preview with play, scrub and scene buttons (port 3010)
pnpm --filter motion-graphics render   # out/promo.mp4
pnpm --filter motion-graphics render --stills 12,27.5,40   # out/stills/*.png, for review
pnpm --filter motion-graphics render --fps 30 --from 17 --to 48
```

## How it works

- `src/scenes/*.tsx`: each scene is markup plus a `build(tl, start)` that adds its animations
  to one master timeline and returns where it ends. Every value is written as `[from, to]`, so
  the timeline can be seeked to any frame, forwards or backwards, with an exact result.
- `src/theme.ts`: colours, durations and easings. `src/anim.ts`: shared motion (entrances,
  exits, springy pops, typing, kinetic captions, the cursor).
- `scripts/render.ts`: starts Vite, seeks headless Chrome to each frame, screenshots it as PNG
  and pipes the frames into ffmpeg. The RGB frames are converted with the BT.709 matrix and the
  file is tagged BT.709 (container and H.264 stream), so QuickTime shows the same colours as
  a browser.

Motion rules: no linear moves except typing, entrances animate two or three properties with
short staggers, exits are faster than entrances, and there are no gradients.

Needs `ffmpeg` on the PATH.
