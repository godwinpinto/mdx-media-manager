import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MediaManagerOptions } from '@mdx-media-manager/core';
import type { Plugin } from 'vite';
import { detectContentRoots } from './fumadocs';
import { placeholderFile, substituteMissingImages } from './missing';
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
  let contentRoots: string[] = [];
  /** Missing images substituted per file, for the late transform to label */
  const missingByFile = new Map<string, string[]>();

  return [
    {
      // Early, so the API is mounted before framework middleware (SSR, server routes).
      name: 'mdx-media-manager:api',
      apply: 'serve',
      enforce: 'pre',
      // MDX files outside the app (shared content) can't resolve the package from where they
      // are, so resolve the injected overlay import as if it came from the app.
      resolveId(id, importer) {
        if (id !== clientModule || !importer) return;
        const relative = path.relative(root, importer.split('?')[0]!);
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) return;
        return this.resolve(id, path.join(root, 'index.js'), { skipSelf: true });
      },
      config() {
        // Pre-bundle the overlay up front instead of re-optimizing on the first MDX page. Skipped
        // when this package is linked from a workspace: pre-bundled copies don't pick up rebuilds.
        const installed = fileURLToPath(import.meta.url)
          .split(path.sep)
          .includes('node_modules');
        return installed ? { optimizeDeps: { include: [clientModule] } } : undefined;
      },
      async configResolved(config) {
        root = options.root ?? config.root;
        contentRoots = [...detectContentRoots(root), ...(options.contentRoots ?? [])];
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
            contentRoots,
            publicDir: options.publicDir ?? server.config.publicDir,
          }).handler,
        );
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith(`${basePath}/`)) return next();
          handle(req, res).catch(next);
        });
      },
      // Before the MDX compiler: keep a missing image from failing the whole page. Fumadocs
      // compiles in an `order: 'pre'` transform, so this one must be `pre` too (and this plugin
      // comes earlier) to see the raw MDX.
      transform: {
        order: 'pre',
        handler(code, id) {
          const [file] = id.split('?');
          if (!file || !include.test(file) || id.includes('virtual:')) return;
          const { code: patched, missing } = substituteMissingImages(code, {
            resourcePath: file,
            publicDir,
          });
          missingByFile.set(file, missing);
          if (missing.length) return { code: patched, map: null };
        },
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
              missing: missingByFile.get(file),
              placeholderFile,
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
