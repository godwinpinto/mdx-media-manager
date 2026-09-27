import { describe, expect, it } from 'vitest';
import { withMdxMediaManager } from '../src/next';

describe('withMdxMediaManager', () => {
  const fumadocsLike = {
    turbopack: {
      rules: {
        '*.{md,mdx}': {
          loaders: [{ loader: 'fumadocs-mdx/webpack/mdx', options: { isDev: true } }],
          as: '*.js',
        },
      },
    },
  };

  it('returns the config untouched outside next dev', async () => {
    const out = await withMdxMediaManager(fumadocsLike, { s3: false })('phase-production-build', {
      defaultConfig: {},
    });
    expect(out).toBe(fumadocsLike);
  });

  it('wraps the MDX loader with serializable options (no undefined values) in dev', async () => {
    process.env.__MDX_MEDIA_MANAGER_URL = 'http://127.0.0.1:1'; // don't start a server in tests
    try {
      const out = await withMdxMediaManager(fumadocsLike, { s3: false })(
        'phase-development-server',
        { defaultConfig: {} },
      );
      const rule = (out.turbopack!.rules as any)['*.{md,mdx}'];
      expect(rule.loaders[0].loader).toBe('mdx-media-manager/loader');
      expect(rule.loaders[0].options.inner).toBe('fumadocs-mdx/webpack/mdx');
      expect(JSON.parse(JSON.stringify(rule.loaders[0].options))).toEqual(rule.loaders[0].options);
      expect(Object.values(rule.loaders[0].options)).not.toContain(undefined);
    } finally {
      delete process.env.__MDX_MEDIA_MANAGER_URL;
    }
  });
});
