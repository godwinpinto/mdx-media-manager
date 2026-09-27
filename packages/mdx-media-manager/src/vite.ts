import fs from 'node:fs/promises';
import type { MediaManagerOptions } from '@mdx-media-manager/core';
import type { Plugin } from 'vite';
import { transformCompiledMdx } from './transform';

export interface MdxMediaManagerViteOptions extends MediaManagerOptions {
  /** Set to `false` (or env `MDX_MEDIA_MANAGER=false`) to turn the overlay off. */
  enabled?: boolean;
  /** Files to instrument. @defaultValue `.md` and `.mdx` files */
  include?: RegExp;
}

const clientModule = 'mdx-media-manager/client';

/**
 * Enable the in-page image manager during `vite dev` (TanStack Start, React Router, …).
 * The plugins only apply to the dev server; builds contain none of it.
 *
 * ```ts
 * plugins: [mdxMediaManager(), fumadocsMdx(), tanstackStart(), react()]
 * ```
 */
export function mdxMediaManager(options: MdxMediaManagerViteOptions = {}): Plugin[] {
  if (options.enabled === false || process.env.MDX_MEDIA_MANAGER === 'false') return [];

  const include = options.include ?? /\.mdx?$/;
  let root = options.root ?? process.cwd();
  let publicDir = '';
  let basePath = '';

  return [
    {
      // Early, so the API is mounted before framework middleware (SSR, server routes).
      name: 'mdx-media-manager:api',
      apply: 'serve',
      enforce: 'pre',
      config() {
        // Pre-bundle the overlay up front instead of re-optimizing on the first MDX page.
        return { optimizeDeps: { include: [clientModule] } };
      },
      async configResolved(config) {
        root = options.root ?? config.root;
        const { resolveOptions } = await import('@mdx-media-manager/core');
        const resolved = resolveOptions({
          ...options,
          root,
          publicDir: options.publicDir ?? config.publicDir,
        });
        publicDir = resolved.publicDir;
        basePath = resolved.basePath;
      },
      async configureServer(server) {
        const { createMediaManager } = await import('@mdx-media-manager/core');
        const { toNodeHandler } = await import('@mdx-media-manager/core/node');
        const handle = toNodeHandler(
          createMediaManager({
            ...options,
            root,
            publicDir: options.publicDir ?? server.config.publicDir,
          }).handler,
        );
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith(`${basePath}/`)) return next();
          handle(req, res).catch(next);
        });
      },
    },
    {
      // Late, so it sees the MDX compiler's output (with `jsxDEV` source positions).
      name: 'mdx-media-manager:transform',
      apply: 'serve',
      enforce: 'post',
      async transform(code, id) {
        const [file] = id.split('?');
        if (!file || !include.test(file) || !code.includes('jsxDEV')) return;

        let source: string;
        try {
          source = await fs.readFile(file, 'utf8');
        } catch {
          return;
        }
        try {
          return {
            code: transformCompiledMdx(code, {
              resourcePath: file,
              source,
              root,
              publicDir,
              basePath,
              clientModule,
            }),
            map: null,
          };
        } catch (error) {
          this.warn(`could not instrument ${file}: ${(error as Error).message}`);
        }
      },
    },
  ];
}
