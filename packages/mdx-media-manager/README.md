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
- **Edit / Delete**: hover an image and use the toolbar in its top-right corner. Edit opens the
  current image: rename it, change its alt text, crop or convert it, or drop/paste a new one.
  Renaming or changing alt text alone doesn't re-encode the image.
- **Add images** by dropping a file anywhere on the dialog, pasting (⌘V / Ctrl+V), or choosing a file.
- **Turn off**: the **Images on/off** button in the bottom-right corner (remembered per browser),
  or `MDX_MEDIA_MANAGER=false next dev`.

### Library

The **Library** button (next to **Images on/off**) opens every image in `public/images`, plus any
other public image your content uses:

- **Browse and search** by name, alt text or page. Each image shows its size, dimensions, format and
  every place it's used, with links that open the page and highlight the spot.
- **Rename everywhere** updates every page that uses the image. If code (e.g. a `.tsx` file) still
  mentions the old URL, the old file is kept and the panel says where.
- **Alt text on every use** sets the same description everywhere, including JSX `<img>`s that had none.
- **Health checks**: _Unused_ images (no page or code file mentions them; delete them one by one or
  all at once), _Missing alt_ text, and _Broken_ references to files that don't exist.
- **Insert from the library**: the Insert dialog has a _From library_ tab that reuses an existing
  file instead of uploading a copy.

Missing images don't break your dev server: Fumadocs turns images into imports, so one missing
file would fail every page. In development they're shown as a _Missing image_ placeholder you can
hover to replace or remove. Production builds still fail on broken references, as they should.

### File names

Images go to `public/images/<page path>/<name>-<hash>.<ext>` and are referenced as
`![alt](/images/…)`. The page path is relative to `content/`, so every collection gets its own
folder: `content/docs/guide.mdx` → `images/docs/guide/`, `content/blog/hello.mdx` →
`images/blog/hello/`.

- Names are URL- and file-system-friendly: lowercase `a–z`, `0–9` and single hyphens, at most 60
  characters. Accents are removed (`Café` → `cafe`), and characters outside the Latin alphabet are
  dropped. The dialog shows the name that will be saved, and blocks names with no letters or digits.
- The short content hash means files never overwrite each other. The same image under the same name
  reuses its file, and a different image under the same name gets its own file. The dialog warns
  when a similar name already exists in the folder.
- A replaced, renamed or deleted image file is removed only when no other project file still
  mentions it.

### Multiple collections and shared content

Every local MDX collection works: `defineDocs` / `defineCollections` in the same app (docs, blog,
changelog, …) are tagged, editable and part of the library.

Content outside the app, such as a `shared/docs` package in a monorepo or Fumadocs `workspaces`, is
editable too. `dir` values written as plain strings in `defineDocs`, `defineCollections` or
`defineConfig({ workspaces })` are detected automatically. Add others with `contentRoots`. Only
`.md`/`.mdx` files in those folders can be edited, and their images go to
`images/<folder name>/<page>`.

Not supported: generated or remote content (OpenAPI pages, remote MDX, CMS sources), since there is
no local file to edit. Collections compiled with Fumadocs' experimental `compiler: 'satteri'`
haven't been tested.

## Options

Pass them as the second argument of `withMdxMediaManager(config, options)` or to
`mdxMediaManager(options)`:

```js
{
  contentDir: 'content', // image folders are named relative to this; default: content, else root
  contentRoots: ['../../shared/docs'], // extra content folders outside the app (auto-detected from Fumadocs)
  publicDir: 'public',
  imagesDir: 'images', // inside publicDir
  image: { format: 'webp', quality: 82, maxWidth: 1600 },
  maxUploadSize: 25 * 1024 * 1024,
  allowedHosts: [], // extra hostnames besides localhost, e.g. a LAN name
  // Page URL for a content file (for the library's "open" links). The default follows Fumadocs:
  // content/docs/a/index.mdx → /docs/a. For example, to drop the content folder name:
  pageUrl: (file) => `/${file.replace(/^content\//, '').replace(/\.mdx?$/, '')}`,
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
