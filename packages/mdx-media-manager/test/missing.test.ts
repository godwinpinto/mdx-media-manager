import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { placeholderFile, substituteMissingImages } from '../src/missing';
import { transformCompiledMdx } from '../src/transform';

let root: string;
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mmm-missing-'));
  await fs.mkdir(path.join(root, 'public/images'), { recursive: true });
  await fs.mkdir(path.join(root, 'content'), { recursive: true });
  await fs.writeFile(path.join(root, 'public/images/here.png'), 'x');
  await fs.writeFile(path.join(root, 'content/local.png'), 'x');
});
afterAll(() => fs.rm(root, { recursive: true, force: true }));

const options = () => ({
  resourcePath: path.join(root, 'content/page.mdx'),
  publicDir: path.join(root, 'public'),
});
const placeholder = pathToFileURL(placeholderFile).href;

describe('substituteMissingImages', () => {
  it('replaces only missing local Markdown images, in order', () => {
    const source = [
      '![a](/images/here.png)',
      '![b](/images/gone.png) and ![c](./local.png) and ![d](./nope.png)',
      '![e](https://example.com/x.png)',
      '<img src="/images/gone-jsx.png" />',
    ].join('\n\n');
    const { code, missing } = substituteMissingImages(source, options());
    expect(missing).toEqual(['/images/gone.png', './nope.png']);
    expect(code).toContain('![a](/images/here.png)');
    expect(code).toContain(`![b](${placeholder}) and ![c](./local.png) and ![d](${placeholder})`);
    expect(code).toContain('<img src="/images/gone-jsx.png" />');
  });

  it('keeps line numbers', () => {
    const source = 'Intro\n\n![x](/images/gone.png)\n\n## Next\n';
    const { code } = substituteMissingImages(source, options());
    expect(code.split('\n')).toHaveLength(source.split('\n').length);
    expect(code.split('\n')[4]).toBe('## Next');
  });

  it('leaves unparsable sources to the real compiler', () => {
    const source = '<Broken\n';
    expect(substituteMissingImages(source, options())).toEqual({ code: source, missing: [] });
  });
});

describe('labelling placeholders', () => {
  it('restores the original URL and marks the image missing', () => {
    const resourcePath = path.join(root, 'content/page.mdx');
    const importPath = path.relative(path.dirname(resourcePath), placeholderFile);
    const code = `import __img0 from ${JSON.stringify(importPath)};
import __img1 from "../public/images/here.png";
export default function MDXContent() {
  return [
    _jsxDEV(_components.img, { src: __img1 }, undefined, false, { fileName: "x" }, this),
    _jsxDEV(_components.img, { src: __img0 }, undefined, false, { fileName: "x" }, this),
  ];
}`;
    const out = transformCompiledMdx(code, {
      resourcePath,
      source: '',
      root,
      publicDir: path.join(root, 'public'),
      basePath: '/__mdx-media',
      clientModule: 'mdx-media-manager/client',
      missing: ['/images/gone.png'],
      placeholderFile,
    });
    expect(out).toContain('"data-mmm-img": "/images/here.png"');
    expect(out).toContain(
      '{"data-mmm-img": "/images/gone.png", "data-mmm-missing": "true",  src: __img0 }',
    );
  });
});
