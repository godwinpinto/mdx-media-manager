import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { placeholderFile, substituteMissingImages } from './missing';
import { transformCompiledMdx } from './transform';

export interface LoaderOptions {
  /** The MDX loader this one wraps (e.g. `fumadocs-mdx/webpack/mdx`) */
  inner: string;
  innerOptions?: unknown;
  root: string;
  publicDir: string;
  basePath: string;
  clientModule: string;
  /** Public URL of the S3 bucket, when images are stored there */
  cdnUrl?: string;
}

type Callback = (err: Error | null | undefined, code?: string, map?: unknown) => void;

interface LoaderContext {
  rootContext: string;
  resourcePath: string;
  getOptions(): LoaderOptions;
  async(): Callback;
}

type InnerLoader = (this: unknown, source: string) => string | undefined | void;

const innerCache = new Map<string, Promise<InnerLoader>>();

function loadInner(specifier: string, root: string): Promise<InnerLoader> {
  let cached = innerCache.get(specifier);
  if (!cached) {
    const resolved = createRequire(join(root, 'package.json')).resolve(specifier);
    cached = import(pathToFileURL(resolved).href).then(
      (mod) => (mod.default ?? mod) as InnerLoader,
    );
    innerCache.set(specifier, cached);
  }
  return cached;
}

/**
 * Development-only wrapper around an MDX loader. It runs the real loader in development mode
 * (so every element keeps its source position), then tags elements for the overlay.
 */
export default function loader(this: LoaderContext, source: string): void {
  const options = this.getOptions();
  const callback = this.async();
  const resourcePath = this.resourcePath;

  let missing: string[] = [];
  const finish: Callback = (err, code, map) => {
    if (err || code === undefined) return callback(err);
    try {
      const out = transformCompiledMdx(code, {
        resourcePath,
        source,
        root: options.root,
        publicDir: options.publicDir,
        basePath: options.basePath,
        clientModule: options.clientModule,
        missing,
        placeholderFile,
      });
      // Positions are baked into the output; the inner source map no longer lines up.
      callback(null, out);
    } catch (error) {
      console.warn(`[mdx-media-manager] could not instrument ${resourcePath}:`, error);
      callback(null, code, map);
    }
  };

  // Turbopack's loader context has no `mode` and is frozen, so the inner loader gets a view where
  // `mode` is `development`: MDX then compiles with `jsxDEV`, which carries source positions.
  const context = new Proxy(this, {
    get(target, key) {
      if (key === 'mode') return 'development';
      if (key === 'getOptions') return () => options.innerOptions ?? {};
      if (key === 'async') return () => finish;
      if (key === 'callback') return finish;
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  Promise.all([
    loadInner(options.inner, this.rootContext),
    substituteMissingImages(source, {
      resourcePath,
      publicDir: options.publicDir,
      cdnUrl: options.cdnUrl,
    }),
  ])
    .then(([inner, substituted]) => {
      missing = substituted.missing;
      const result = inner.call(context, substituted.code);
      if (typeof result === 'string') finish(null, result);
    })
    .catch((err: Error) => callback(err));
}
