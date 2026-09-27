import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import type { MediaManagerOptions } from '@mdx-media-manager/core';
import type { LoaderOptions } from './loader';

type ConfigContext = { defaultConfig: NextConfig };
type ConfigInput =
  | NextConfig
  | PromiseLike<NextConfig>
  | ((phase: string, context: ConfigContext) => NextConfig | PromiseLike<NextConfig>);

export interface WithMdxMediaManagerOptions extends MediaManagerOptions {
  /** Set to `false` (or env `MDX_MEDIA_MANAGER=false`) to turn the overlay off. */
  enabled?: boolean;
  /** MDX loaders to instrument, matched by name. @defaultValue fumadocs-mdx and @mdx-js/loader */
  loaders?: string[];
}

const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';
const SERVER_URL_ENV = '__MDX_MEDIA_MANAGER_URL';
const defaultLoaders = ['fumadocs-mdx/webpack/mdx', '@mdx-js/loader'];

type LoaderItem = string | { loader: string; options?: unknown };

function wrapLoaders<T extends LoaderItem>(
  items: T[],
  names: string[],
  base: Omit<LoaderOptions, 'inner' | 'innerOptions'>,
): T[] {
  return items.map((item) => {
    const name = typeof item === 'string' ? item : item.loader;
    if (!names.includes(name)) return item;
    const options: LoaderOptions = {
      ...base,
      inner: name,
      innerOptions: typeof item === 'string' ? undefined : item.options,
    };
    const rest: object = typeof item === 'string' ? {} : item;
    return { ...rest, loader: 'mdx-media-manager/loader', options } as T;
  });
}

function wrapTurbopackRules(
  rules: Record<string, unknown> | undefined,
  names: string[],
  base: Omit<LoaderOptions, 'inner' | 'innerOptions'>,
) {
  if (!rules) return rules;
  const wrapRule = (rule: any): any => {
    if (Array.isArray(rule)) return rule.map(wrapRule);
    if (rule && typeof rule === 'object' && Array.isArray(rule.loaders)) {
      return { ...rule, loaders: wrapLoaders(rule.loaders, names, base) };
    }
    return rule;
  };
  return Object.fromEntries(Object.entries(rules).map(([glob, rule]) => [glob, wrapRule(rule)]));
}

function wrapWebpackRules(
  rules: any[] | undefined,
  names: string[],
  base: Omit<LoaderOptions, 'inner' | 'innerOptions'>,
): void {
  for (const rule of rules ?? []) {
    if (!rule || typeof rule !== 'object') continue;
    if (Array.isArray(rule.use)) rule.use = wrapLoaders(rule.use, names, base);
    else if (typeof rule.loader === 'string' && names.includes(rule.loader)) {
      const [wrapped] = wrapLoaders([{ loader: rule.loader, options: rule.options }], names, base);
      rule.loader = wrapped!.loader;
      rule.options = (wrapped as { options: unknown }).options;
    }
    wrapWebpackRules(rule.oneOf, names, base);
    wrapWebpackRules(rule.rules, names, base);
  }
}

/** Start the API once per dev server process tree and remember where it listens. */
async function ensureServer(options: MediaManagerOptions): Promise<string> {
  const existing = process.env[SERVER_URL_ENV];
  if (existing) return existing;
  const { createMediaManager } = await import('@mdx-media-manager/core');
  const { startDevServer } = await import('@mdx-media-manager/core/node');
  const server = await startDevServer(createMediaManager(options));
  process.env[SERVER_URL_ENV] = server.url;
  return server.url;
}

/**
 * Enable the in-page image manager during `next dev`. Outside development this returns your
 * config untouched, so production builds contain none of it.
 *
 * ```js
 * export default withMdxMediaManager(withMDX(config));
 * ```
 */
export function withMdxMediaManager(
  config: ConfigInput = {},
  options: WithMdxMediaManagerOptions = {},
) {
  return async (phase: string, context: ConfigContext): Promise<NextConfig> => {
    const resolved = await (typeof config === 'function' ? config(phase, context) : config);
    if (
      phase !== PHASE_DEVELOPMENT_SERVER ||
      options.enabled === false ||
      process.env.MDX_MEDIA_MANAGER === 'false'
    ) {
      return resolved;
    }

    const { resolveOptions } = await import('@mdx-media-manager/core');
    const { detectContentRoots } = await import('./fumadocs');
    const root = options.root ?? process.cwd();
    const serverOptions = {
      ...options,
      contentRoots: [...detectContentRoots(root), ...(options.contentRoots ?? [])],
    };
    const resolvedOptions = resolveOptions(serverOptions);
    const serverUrl = await ensureServer(serverOptions);
    const names = options.loaders ?? defaultLoaders;
    const base = {
      root: resolvedOptions.root,
      publicDir: resolvedOptions.publicDir,
      basePath: resolvedOptions.basePath,
      // By file path: MDX files outside the app (shared content) can't resolve the package name.
      clientModule: fileURLToPath(new URL('./client.js', import.meta.url)),
    };

    const ours = [
      {
        source: `${resolvedOptions.basePath}/:path*`,
        destination: `${serverUrl}${resolvedOptions.basePath}/:path*`,
      },
    ];

    return {
      ...resolved,
      turbopack: {
        ...resolved.turbopack,
        rules: wrapTurbopackRules(resolved.turbopack?.rules, names, base) as NonNullable<
          NextConfig['turbopack']
        >['rules'],
      },
      webpack(webpackConfig, webpackContext) {
        const out = resolved.webpack
          ? resolved.webpack(webpackConfig, webpackContext)
          : webpackConfig;
        wrapWebpackRules(out.module?.rules, names, base);
        return out;
      },
      async rewrites() {
        const existing = await resolved.rewrites?.();
        if (!existing) return { beforeFiles: ours, afterFiles: [], fallback: [] };
        if (Array.isArray(existing))
          return { beforeFiles: ours, afterFiles: existing, fallback: [] };
        return { ...existing, beforeFiles: [...ours, ...(existing.beforeFiles ?? [])] };
      },
    };
  };
}
