# motion-graphics

The promo film for mdx-media-manager, built from mock UI (skeletons, a mock browser, dialog,
library and code panel) animated with [anime.js](https://animejs.com) v4. No screen recordings
and no sound. Light mode, 1920×1080, 60 fps, about 40 seconds at the default 2× speed.

```bash
pnpm --filter motion-graphics dev                  # preview: play, scrub, jump to scenes (port 3010; add ?sound for audio)
pnpm --filter motion-graphics render --blur 4      # out/promo.mp4 with motion blur (~12 min)
pnpm --filter motion-graphics render               # the same without motion blur (~2 min)
pnpm --filter motion-graphics render --audio       # with the synthesized soundtrack
pnpm --filter motion-graphics render --speed 1.5   # out/promo-1.5x.mp4 (default speed is 2×)
pnpm --filter motion-graphics render --stills 3,12.5,40   # out/stills/*.png, for review
pnpm --filter motion-graphics render --soundtrack  # out/soundtrack.wav only
```

## How it works

- `src/scenes/*.tsx`: each scene is markup plus a `build(tl, start)` that adds its animations
  to one master timeline and returns where it ends. Every value is written as `[from, to]`, so
  the timeline can be seeked to any frame, forwards or backwards, with an exact result. Random
  values come from a seeded generator, so every render is identical.
- The opening (`intro.tsx`) is one continuous shot through a camera (`#world`): letters fly in
  and assemble, dissolve into particles that form a page, the camera pulls back over a grid of
  pages and pushes into an empty image slot, the manual steps land one by one and are ticked
  off, then everything implodes and the name bursts out of the impact.
- `src/audio.ts` (optional, off by default): a music bed and effects cued from the same
  timeline (whooshes, pops, typing ticks, clicks, a riser and an impact), rendered offline with
  the Web Audio API. The shared helpers in `src/anim.ts` cue their own sounds.
- `src/theme.ts`: colours, durations, easings and the playback speed.
- `scripts/render.ts`: starts Vite, seeks headless Chrome to each frame and screenshots it
  (with `--blur N`, N sub-frames over a 180° shutter, averaged) and pipes the frames into
  ffmpeg. With `--audio` it also muxes the soundtrack (AAC, loudness-normalised to −16 LUFS).
  RGB frames are converted with the BT.709 matrix and tagged BT.709 in the container and the
  H.264 stream, so QuickTime shows the same colours as a browser.

Motion rules: no linear moves except typing and marching borders, entrances animate two or
three properties with short staggers, exits are faster than entrances, big hits land on the
beat, and there are no gradients.

Needs `ffmpeg` on the PATH.
