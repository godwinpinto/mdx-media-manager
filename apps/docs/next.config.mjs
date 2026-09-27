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
