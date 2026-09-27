# mdx-media-manager

Add, replace and delete images in your MDX docs **from the rendered page**, while running your dev
server. Images are cropped, resized and converted (WebP by default) and written to `public/`, and
the `.mdx` source is edited in place, so hot reload shows the result immediately.

Development only: outside `next dev` the integration returns your config untouched, so production
builds contain none of it.

## Setup (Next.js + Fumadocs)

```bash
pnpm add -D mdx-media-manager
```

```js
// next.config.mjs
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Loaded only by `next dev`, so production (`next build` / `next start`) never needs the package.
const withMediaManager =
  process.env.NODE_ENV === 'development'
    ? (await import('mdx-media-manager/next')).withMdxMediaManager
    : (config) => config;

export default withMediaManager(withMDX({ reactStrictMode: true }));
```

The package can stay a devDependency: production installs without devDependencies still work,
because the import only runs in development.

That's it: no route files, no components to add. Run `next dev` and hover your docs.

- **Insert**: hover any block (paragraphs, headings, lists, code, tables, and content inside
  components like `<Callout>` or `<Tab>`), then click **+ Image above/below**.
- **Replace / Delete**: hover an image and use the toolbar in its top-right corner.
- **Turn off**: the **Images on/off** button in the bottom-right corner (remembered per browser),
  or `MDX_MEDIA_MANAGER=false next dev`.

Images go to `public/images/<page path>/<name>-<hash>.webp` and are referenced as
`![alt](/images/…)`. A replaced or deleted image file is removed only when no other project file
still mentions it.

## Options

```js
withMdxMediaManager(config, {
  contentDir: 'content/docs', // default: content/docs, else content
  publicDir: 'public',
  imagesDir: 'images', // inside publicDir
  image: { format: 'webp', quality: 82, maxWidth: 1600 },
  maxUploadSize: 25 * 1024 * 1024,
  allowedHosts: [], // extra hostnames besides localhost, e.g. a LAN name
});
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

A TanStack Start / Vite integration is planned.
