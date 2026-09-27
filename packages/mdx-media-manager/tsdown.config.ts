import { defineConfig } from 'tsdown';

export default defineConfig({
  dts: { sourcemap: false },
  fixedExtension: false,
  target: 'es2023',
  format: 'esm',
  entry: [
    'src/next.ts',
    'src/vite.ts',
    'src/cli.ts',
    'src/loader.ts',
    'src/client.ts',
    'src/server.ts',
  ],
});
