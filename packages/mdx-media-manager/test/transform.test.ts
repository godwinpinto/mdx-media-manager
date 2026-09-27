import { compile } from '@mdx-js/mdx';
import { describe, expect, it } from 'vitest';
import { hashSource } from '@mdx-media-manager/core/mdx';
import { transformCompiledMdx } from '../src/transform';

const root = '/project';
const resourcePath = '/project/content/docs/page.mdx';

async function run(source: string, rehypePlugins: never[] = []) {
  const compiled = String(
    await compile({ value: source, path: resourcePath }, { development: true, rehypePlugins }),
  );
  return transformCompiledMdx(compiled, {
    resourcePath,
    source,
    root,
    publicDir: '/project/public',
    basePath: '/__mdx-media',
    clientModule: 'mdx-media-manager/client',
  });
}

const tag = (source: string, position: string, element: string, sibling?: number) =>
  `"data-mmm": ${JSON.stringify(`content/docs/page.mdx|${hashSource(source)}|${position}|${element}${sibling ? `|${sibling}` : ''}`)}`;

describe('transformCompiledMdx', () => {
  it('tags blocks, inline elements and components with their source position', async () => {
    const source = `# Title\n\nSome *text*.\n\n<Callout>\n  Inside.\n</Callout>\n`;
    const out = await run(source);
    expect(out).toContain(tag(source, '1:1', 'h1'));
    expect(out).toContain(tag(source, '3:1', 'p'));
    expect(out).toContain(tag(source, '3:6', 'em'));
    expect(out).toContain(tag(source, '5:1', 'Callout'));
    expect(out).toContain(tag(source, '6:3', 'p'));
  });

  it('keeps the source URL of images', async () => {
    const source = `![Alt](/images/a.png)\n`;
    const out = await run(source);
    expect(out).toContain(`"data-mmm-img": "/images/a.png"`);
  });

  it('maps static image imports back to public URLs', async () => {
    const source = `Text\n`;
    const compiled = String(
      await compile({ value: source, path: resourcePath }, { development: true }),
    );
    const withImport = `import __img0 from "../../public/images/b.png";\n${compiled.replace(
      '_jsxDEV(_components.p, {',
      '_jsxDEV(_components.p, { children: _jsxDEV(_components.img, { src: __img0 }, undefined, false, { fileName: "x" }, this), ',
    )}`;
    const out = transformCompiledMdx(withImport, {
      resourcePath,
      source,
      root,
      publicDir: '/project/public',
      basePath: '/__mdx-media',
      clientModule: 'mdx-media-manager/client',
    });
    expect(out).toContain(`"data-mmm-img": "/images/b.png"`);
    // The generated image points at its paragraph
    expect(out.match(new RegExp(tag(source, '1:1', 'p').replace(/[|]/g, '\\|'), 'g'))).toHaveLength(
      2,
    );
  });

  it('tags generated blocks relative to a positioned sibling', async () => {
    const source = `## A\n\n\`\`\`js\nlet a;\n\`\`\`\n`;
    // Simulate a highlighter that replaces the code block with a new, position-less node.
    const dropPositions =
      () => (tree: { children: { tagName?: string; position?: unknown }[] }) => {
        for (const node of tree.children) if (node.tagName === 'pre') delete node.position;
      };
    const out = await run(source, [dropPositions as never]);
    expect(out).toContain(tag(source, '1:1', 'h2', 1));
  });

  it('wraps the default export with the overlay', async () => {
    const out = await run('Hello\n');
    expect(out).not.toMatch(/export default function MDXContent\b/);
    expect(out).toContain(
      'import { MediaManagerOverlay as __mmm_Overlay } from "mdx-media-manager/client"',
    );
    expect(out).toContain('export default function MDXContentWithMediaManager(props)');
    expect(out).toContain('{"basePath":"/__mdx-media"}');
  });
});
