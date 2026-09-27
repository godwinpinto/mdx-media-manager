import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

// `shared/handbook` lives outside this app and is served at /handbook (see lib/source.ts).
const handbookDir = '../../shared/handbook/';

/** @type {import('mdx-media-manager/next').WithMdxMediaManagerOptions} */
const mediaManagerOptions = {
  // Library "open" links for handbook pages. Other pages return undefined and keep the default
  // (content/docs/x.mdx → /docs/x, content/blog/x.mdx → /blog/x).
  pageUrl: (file) => {
    if (!file.startsWith(handbookDir)) return undefined;
    const page = file
      .slice(handbookDir.length)
      .replace(/\.mdx?$/, '')
      .replace(/(^|\/)index$/, '');
    return page ? `/handbook/${page}` : '/handbook';
  },
};

// mdx-media-manager: edit images from the rendered page. Loaded only by `next dev`,
// so production builds and `next start` never need the package.
const withMediaManager = (input) => async (phase, context) => {
  if (phase === 'phase-development-server') {
    const { withMdxMediaManager } = await import('mdx-media-manager/next');
    return withMdxMediaManager(input, mediaManagerOptions)(phase, context);
  }
  return typeof input === 'function' ? input(phase, context) : input;
};

export default withMediaManager(withMDX(config));
