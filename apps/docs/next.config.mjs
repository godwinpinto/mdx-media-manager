import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Loaded only by `next dev`, so production (`next build` / `next start`) never needs the package.
const withMediaManager =
  process.env.NODE_ENV === 'development'
    ? (await import('mdx-media-manager/next')).withMdxMediaManager
    : (config) => config;

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMediaManager(withMDX(config));
