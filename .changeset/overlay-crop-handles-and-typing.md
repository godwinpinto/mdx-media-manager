---
'@mdx-media-manager/ui': patch
---

Show the cropper's drag handles and edges: its sizes were declared on `:root`, which the overlay's shadow root never matched, so they rendered at zero size. Keystrokes typed into the overlay's fields no longer reach the page's own shortcuts (such as the Next.js dev tools', which swallowed "d").
