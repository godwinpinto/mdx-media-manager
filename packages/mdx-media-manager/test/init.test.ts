import { describe, expect, it } from 'vitest';
import { addToNextConfig, addToViteConfig, InitError } from '../src/init';

function updated(result: ReturnType<typeof addToNextConfig>): string {
  if (result.status !== 'updated') throw new Error('expected an update');
  return result.code;
}

describe('addToNextConfig', () => {
  const fumadocs = `import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMDX(config);
`;

  it('wraps a Fumadocs config with a dev-only helper', () => {
    const out = updated(addToNextConfig(fumadocs, 'next.config.mjs'));
    expect(out).toContain('export default withMediaManager(withMDX(config));');
    expect(out).toContain("if (phase === 'phase-development-server') {");
    expect(out).toContain("await import('mdx-media-manager/next');");
    // helper goes right before the export, the rest is untouched
    expect(out.startsWith(fumadocs.slice(0, fumadocs.indexOf('export default')))).toBe(true);
    // no static import of the package: production never resolves it
    expect(out).not.toMatch(/^import .*mdx-media-manager/m);
    expect(out).not.toMatch(/^\s*await /m);
  });

  it('writes a typed helper for next.config.ts and keeps double quotes', () => {
    const code = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
`;
    const out = updated(addToNextConfig(code, 'next.config.ts'));
    expect(out).toContain(
      'type MediaManagerInput = Parameters<typeof import("mdx-media-manager/next").withMdxMediaManager>[0];',
    );
    expect(out).toContain('(input: MediaManagerInput) =>');
    expect(out).toContain('export default withMediaManager(nextConfig);');
  });

  it('handles `satisfies` and CommonJS', () => {
    expect(
      updated(
        addToNextConfig(
          `const c = {};\nexport default c satisfies NextConfig;\n`,
          'next.config.ts',
        ),
      ),
    ).toContain('export default withMediaManager(c satisfies NextConfig);');
    const cjs = updated(
      addToNextConfig(
        `const withMDX = require('x')();\nmodule.exports = withMDX({});\n`,
        'next.config.js',
      ),
    );
    expect(cjs).toContain('module.exports = withMediaManager(withMDX({}));');
    expect(cjs).toContain("await import('mdx-media-manager/next')");
  });

  it('is idempotent', () => {
    const once = updated(addToNextConfig(fumadocs, 'next.config.mjs'));
    expect(addToNextConfig(once, 'next.config.mjs')).toEqual({ status: 'already-configured' });
  });

  it('explains when there is no export', () => {
    expect(() => addToNextConfig('const a = 1;\n', 'next.config.mjs')).toThrow(InitError);
  });
});

describe('addToViteConfig', () => {
  const tanstack = `import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    fumadocsMdx(),
    react(),
  ],
});
`;

  it('adds the plugin first, on its own line, and imports it', () => {
    const out = updated(addToViteConfig(tanstack, 'vite.config.ts'));
    expect(out).toContain(`  plugins: [\n    mdxMediaManager(),\n    fumadocsMdx(),`);
    expect(out).toContain(
      `import { fumadocsMdx } from 'fumadocs-mdx/vite';\nimport { mdxMediaManager } from 'mdx-media-manager/vite';\n`,
    );
  });

  it('handles inline arrays, empty arrays and missing plugins', () => {
    expect(
      updated(
        addToViteConfig(
          `import { defineConfig } from "vite"\nexport default defineConfig({ plugins: [react()] })\n`,
          'vite.config.js',
        ),
      ),
    ).toBe(
      `import { defineConfig } from "vite"\nimport { mdxMediaManager } from "mdx-media-manager/vite"\nexport default defineConfig({ plugins: [mdxMediaManager(), react()] })\n`,
    );
    expect(
      updated(addToViteConfig(`export default { plugins: [] };\n`, 'vite.config.mjs')),
    ).toContain('plugins: [mdxMediaManager()]');
    const fn = updated(
      addToViteConfig(
        `import { defineConfig } from 'vite';\nexport default defineConfig(() => ({\n  base: '/',\n}));\n`,
        'vite.config.ts',
      ),
    );
    expect(fn).toContain(`  plugins: [mdxMediaManager()],\n  base: '/',`);
  });

  it('refuses configs it cannot edit safely', () => {
    expect(() =>
      addToViteConfig(`const plugins = [];\nexport default { plugins };\n`, 'vite.config.ts'),
    ).toThrow(/not an array literal/);
    expect(() => addToViteConfig(`export default makeConfig;\n`, 'vite.config.ts')).toThrow(
      /Add it manually/,
    );
  });
});
