import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'tsdown';

const require = createRequire(import.meta.url);

export default defineConfig({
  dts: { sourcemap: false },
  fixedExtension: false,
  target: 'es2023',
  format: 'esm',
  platform: 'browser',
  entry: ['src/index.tsx'],
  outputOptions: {
    // The overlay is a client component; keep the directive at the top of the bundle.
    banner: "'use client';",
  },
  plugins: [
    {
      // The overlay lives in a shadow root, so third-party CSS is inlined as text and
      // injected there instead of being imported globally.
      name: 'css-text',
      resolveId: {
        order: 'pre',
        handler(source) {
          if (source.endsWith('.css?text'))
            return `\0css-text:${require.resolve(source.slice(0, -5))}#text`;
        },
      },
      load(id) {
        if (id.startsWith('\0css-text:')) {
          return `export default ${JSON.stringify(readFileSync(id.slice('\0css-text:'.length, -'#text'.length), 'utf8'))};`;
        }
      },
    },
  ],
});
