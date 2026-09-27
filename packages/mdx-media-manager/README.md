# mdx-media-manager

Add, replace and delete images in your MDX docs **from the rendered page**, while running your dev
server. Images are cropped, resized and converted (WebP by default) and written to `public/`, and
the `.mdx` source is edited in place, so hot reload shows the result immediately.

Development only: outside your dev server (`next dev`, `vite dev`) nothing is added, so production
builds contain none of it.

## Setup

In your app's folder:

```bash
npx mdx-media-manager init
```

It detects Next.js (`next.config.*`) or Vite (`vite.config.*`, e.g. TanStack Start), adds the package
as a devDependency with your package manager, and edits the config file for you. Options:
`--dry-run` to preview, `--no-install`, `--cwd <dir>`, `--framework next|vite`. Running it again is
safe.

That's it: no route files, no components to add. Start your dev server and hover your docs.

### What it writes: Next.js

A small helper that loads the package only in `next dev`, so production builds and `next start`
never need it (it can stay a devDependency even when production installs skip them). It works in
`next.config.mjs`, `.js`, `.cjs` and `.ts` (typed there):

```js
// next.config.mjs
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

// mdx-media-manager: edit images from the rendered page. Loaded only by `next dev`,
// so production builds and `next start` never need the package.
const withMediaManager = (input) => async (phase, context) => {
  if (phase === 'phase-development-server') {
    const { withMdxMediaManager } = await import('mdx-media-manager/next');
    return withMdxMediaManager(input)(phase, context);
  }
  return typeof input === 'function' ? input(phase, context) : input;
};

export default withMediaManager(withMDX(config));
```

### What it writes: Vite / TanStack Start

```ts
// vite.config.ts
import { mdxMediaManager } from 'mdx-media-manager/vite';

export default defineConfig({
  plugins: [mdxMediaManager(), fumadocsMdx(), tanstackStart(), react()],
});
```

The plugins only apply to `vite dev` (`apply: 'serve'`): the API is mounted on Vite's dev server
and compiled MDX is tagged in a late `transform`. Builds contain none of it, and the production
server never loads `vite.config.ts`.

## Using it

- **Insert**: hover any block (paragraphs, headings, lists, code, tables, and content inside
  components like `<Callout>` or `<Tab>`), then click **+ Image above/below**.
- **Replace / Delete**: hover an image and use the toolbar in its top-right corner.
- **Turn off**: the **Images on/off** button in the bottom-right corner (remembered per browser),
  or `MDX_MEDIA_MANAGER=false next dev`.

Images go to `public/images/<page path>/<name>-<hash>.webp` and are referenced as
`![alt](/images/…)`. A replaced or deleted image file is removed only when no other project file
still mentions it.

## Options

Pass them as the second argument of `withMdxMediaManager(config, options)` or to
`mdxMediaManager(options)`:

```js
{
  contentDir: 'content/docs', // default: content/docs, else content
  publicDir: 'public',
  imagesDir: 'images', // inside publicDir
  image: { format: 'webp', quality: 82, maxWidth: 1600 },
  maxUploadSize: 25 * 1024 * 1024,
  allowedHosts: [], // extra hostnames besides localhost, e.g. a LAN name
}
```

## How it works

1. MDX compiled in development mode records where every element came from. The integration wraps
   your MDX loader so this is on (Turbopack's loader context doesn't expose `mode`), and copies
   each location into a `data-mmm` attribute. It also mounts the overlay on MDX pages.
2. The overlay (a shadow-DOM React root) reads those attributes under your pointer.
3. Edits go to a Web-standard API (`Request → Response`) that the dev server proxies at
   `/__mdx-media`. It checks the file hasn't changed since the page rendered (409 otherwise),
   processes the image with sharp, writes it, then splices the source at the exact position —
   the rest of the file stays byte-for-byte identical.

The API only answers local requests (localhost host and origin, plus a custom header), refuses
paths outside the project, and re-encodes every upload.

## Other frameworks

The server is framework-agnostic:

```ts
import { createMediaManager } from 'mdx-media-manager/server';

const { handler } = createMediaManager({ root: process.cwd() });
// handler(request: Request): Promise<Response> — mount under /__mdx-media in development
```
