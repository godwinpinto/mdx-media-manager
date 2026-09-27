import { describe, expect, it } from 'vitest';
import { EditError, insertImage, listImageUrls, removeImage, replaceImage } from '../src/mdx';

const doc = `---
title: Demo
---

Intro paragraph with **bold**.

<Callout title="Heads up">
  First callout paragraph.

  Second callout paragraph.
</Callout>

- one
- two

> Quoted text.

![Old](/images/demo/old.png)

Text with ![inline](/images/demo/inline.png) image.
`;

const img = (url: string, alt = 'New') => ({ url, alt });

describe('insertImage', () => {
  it('inserts after a top-level paragraph', () => {
    const out = insertImage(
      doc,
      {
        target: { line: 5, column: 1, element: 'p' },
        position: 'after',
        ...img('/images/demo/a.webp'),
      },
      'mdx',
    );
    expect(out).toContain(
      'Intro paragraph with **bold**.\n\n![New](/images/demo/a.webp)\n\n<Callout',
    );
  });

  it('inserts before a top-level paragraph', () => {
    const out = insertImage(
      doc,
      {
        target: { line: 5, column: 1, element: 'p' },
        position: 'before',
        ...img('/images/demo/a.webp'),
      },
      'mdx',
    );
    expect(out).toContain('---\n\n![New](/images/demo/a.webp)\n\nIntro paragraph');
  });

  it('climbs from an inline element to its block', () => {
    const out = insertImage(
      doc,
      { target: { line: 5, column: 22, element: 'strong' }, position: 'after', ...img('/x.webp') },
      'mdx',
    );
    expect(out).toContain('**bold**.\n\n![New](/x.webp)\n\n<Callout');
  });

  it('inserts inside a JSX component with matching indentation', () => {
    const out = insertImage(
      doc,
      { target: { line: 8, column: 3, element: 'p' }, position: 'after', ...img('/x.webp') },
      'mdx',
    );
    expect(out).toContain(
      '  First callout paragraph.\n\n  ![New](/x.webp)\n\n  Second callout paragraph.',
    );
  });

  it('inserts after a whole JSX component', () => {
    const out = insertImage(
      doc,
      { target: { line: 7, column: 1, element: 'Callout' }, position: 'after', ...img('/x.webp') },
      'mdx',
    );
    expect(out).toContain('</Callout>\n\n![New](/x.webp)\n\n- one');
  });

  it('inserts inside a list item, indented to its content', () => {
    const out = insertImage(
      doc,
      { target: { line: 13, column: 1, element: 'li' }, position: 'after', ...img('/x.webp') },
      'mdx',
    );
    expect(out).toContain('- one\n\n  ![New](/x.webp)\n- two');
  });

  it('inserts after a whole list', () => {
    const out = insertImage(
      doc,
      { target: { line: 13, column: 1, element: 'ul' }, position: 'after', ...img('/x.webp') },
      'mdx',
    );
    expect(out).toContain('- two\n\n![New](/x.webp)\n\n> Quoted');
  });

  it('keeps blockquote markers', () => {
    const out = insertImage(
      doc,
      { target: { line: 16, column: 3, element: 'p' }, position: 'after', ...img('/x.webp') },
      'mdx',
    );
    expect(out).toContain('> Quoted text.\n>\n> ![New](/x.webp)');
  });

  it('escapes alt text and urls with spaces', () => {
    const out = insertImage(
      doc,
      { target: { line: 5, column: 1 }, position: 'after', url: '/a b.webp', alt: 'a [b]' },
      'mdx',
    );
    expect(out).toContain('![a \\[b\\]](</a b.webp>)');
  });

  it('targets a generated block through its positioned sibling', () => {
    const src = `## Code\n\n\`\`\`js\nlet a;\n\`\`\`\n\n## Next\n`;
    const out = insertImage(
      src,
      {
        target: { line: 1, column: 1, element: 'h2', sibling: 1 },
        position: 'after',
        ...img('/x.webp'),
      },
      'mdx',
    );
    expect(out).toBe(`## Code\n\n\`\`\`js\nlet a;\n\`\`\`\n\n![New](/x.webp)\n\n## Next\n`);
    const before = insertImage(
      src,
      {
        target: { line: 7, column: 1, element: 'h2', sibling: -1 },
        position: 'before',
        ...img('/x.webp'),
      },
      'mdx',
    );
    expect(before).toBe(`## Code\n\n![New](/x.webp)\n\n\`\`\`js\nlet a;\n\`\`\`\n\n## Next\n`);
  });

  it('rejects unknown positions', () => {
    expect(() =>
      insertImage(
        doc,
        { target: { line: 99, column: 1 }, position: 'after', ...img('/x.webp') },
        'mdx',
      ),
    ).toThrow(EditError);
  });

  it('leaves the rest of the file byte-for-byte identical', () => {
    const out = insertImage(
      doc,
      { target: { line: 5, column: 1 }, position: 'after', ...img('/x.webp') },
      'mdx',
    );
    expect(out.replace('\n\n![New](/x.webp)', '')).toBe(doc);
  });
});

describe('replaceImage', () => {
  it('replaces a block image found through its paragraph', () => {
    const out = replaceImage(
      doc,
      {
        image: { target: { line: 18, column: 1, element: 'p' }, url: '/images/demo/old.png' },
        url: '/images/demo/new.webp',
      },
      'mdx',
    );
    expect(out).toContain('![Old](/images/demo/new.webp)');
    expect(out).not.toContain('old.png');
  });

  it('can update alt text', () => {
    const out = replaceImage(
      doc,
      { image: { target: { line: 18, column: 1 } }, url: '/n.webp', alt: 'Fresh' },
      'mdx',
    );
    expect(out).toContain('![Fresh](/n.webp)');
  });

  it('replaces src on a JSX img', () => {
    const src = `<Callout>\n  <img src="/a.png" alt="A" />\n</Callout>\n`;
    const out = replaceImage(
      src,
      { image: { target: { line: 2, column: 3, element: 'img' } }, url: '/b.webp' },
      'mdx',
    );
    expect(out).toBe(`<Callout>\n  <img src="/b.webp" alt="A" />\n</Callout>\n`);
  });

  it('picks the right image by url among several', () => {
    const src = `![a](/a.png) and ![b](/b.png)\n`;
    const out = replaceImage(
      src,
      { image: { target: { line: 1, column: 1, element: 'p' }, url: '/b.png' }, url: '/c.webp' },
      'mdx',
    );
    expect(out).toBe(`![a](/a.png) and ![b](/c.webp)\n`);
  });
});

describe('removeImage', () => {
  it('removes a block image with its blank line', () => {
    const out = removeImage(
      doc,
      { target: { line: 18, column: 1, element: 'p' }, url: '/images/demo/old.png' },
      'mdx',
    );
    expect(out).toContain('> Quoted text.\n\nText with');
  });

  it('removes an inline image only', () => {
    const out = removeImage(
      doc,
      { target: { line: 20, column: 1, element: 'p' }, url: '/images/demo/inline.png' },
      'mdx',
    );
    expect(out).toContain('Text with image.');
  });

  it('removes an image inside a JSX component', () => {
    const src = `<Tab>\n  Text.\n\n  ![x](/x.png)\n</Tab>\n`;
    const out = removeImage(src, { target: { line: 4, column: 3, element: 'p' } }, 'mdx');
    expect(out).toBe(`<Tab>\n  Text.\n</Tab>\n`);
  });

  it('removes a JSX img element', () => {
    const src = `Before.\n\n<img src="/a.png" />\n\nAfter.\n`;
    const out = removeImage(src, { target: { line: 3, column: 1, element: 'img' } }, 'mdx');
    expect(out).toBe(`Before.\n\nAfter.\n`);
  });
});

describe('listImageUrls', () => {
  it('lists markdown and JSX images', () => {
    expect(listImageUrls(doc + '\n<img src="/j.png" />\n', 'mdx')).toEqual([
      '/images/demo/old.png',
      '/images/demo/inline.png',
      '/j.png',
    ]);
  });
});
