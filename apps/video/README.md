# video

Records the ~30 second teaser (`out/teaser.mp4`, 1920×1080) from the real overlay running on the
docs site, so it can be re-recorded whenever the UI changes.

```bash
pnpm --filter docs dev      # in one terminal (port 3002)
pnpm --filter video record  # in another
```

- `src/stage.html`: the title scenes, captions and the browser frame around the live site.
- `src/record.ts`: seeds a few images for the library, drives the overlay with a drawn cursor,
  then restores `apps/docs/content` and removes the images it created. It refuses to run when
  that folder has uncommitted changes.
- `src/screencast.ts`: captures Chrome's screencast frames and encodes them with ffmpeg as
  BT.709-tagged H.264, so QuickTime, browsers and social players show the same colours.

Needs `ffmpeg` on the PATH.
