import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: { sourcemap: false },
  fixedExtension: false,
  target: 'es2023',
  format: 'esm',
  platform: 'node',
  entry: ['src/index.ts', 'src/node.ts', 'src/mdx/index.ts'],
});
