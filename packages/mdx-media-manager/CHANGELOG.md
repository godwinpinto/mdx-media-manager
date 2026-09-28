# mdx-media-manager

## 0.1.0-beta.1

### Patch Changes

- b720665: Keep the image toolbar's "Confirm delete" button red while it's hovered. The toolbar's hover style overrode it, so the white label was invisible on a near-white background exactly when you went to click it.

## 0.1.0-beta.0

### Minor Changes

- First release: add, replace and delete images in MDX from the rendered page during development, for Fumadocs on Next.js and Vite (TanStack Start). Includes free-form cropping and WebP/AVIF conversion, an image library (usages, rename everywhere, alt text, unused and broken images), multiple content collections, optional S3 or Cloudflare R2 storage served from a CDN, and an `init` command that sets it up.
