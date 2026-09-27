import { createMDX } from 'fumadocs-mdx/next';
import { withMdxMediaManager } from 'mdx-media-manager/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMdxMediaManager(withMDX(config));
