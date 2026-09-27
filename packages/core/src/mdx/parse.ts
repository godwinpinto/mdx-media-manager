import type { Root } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export type SourceFormat = 'md' | 'mdx';

const processors = {
  mdx: unified().use(remarkParse).use(remarkFrontmatter).use(remarkGfm).use(remarkMdx).freeze(),
  md: unified().use(remarkParse).use(remarkFrontmatter).use(remarkGfm).freeze(),
};

export function formatOf(filePath: string): SourceFormat {
  return filePath.endsWith('.md') ? 'md' : 'mdx';
}

/**
 * Parse source into mdast with positions. Throws when the source is not valid MDX.
 */
export function parse(source: string, format: SourceFormat = 'mdx'): Root {
  return processors[format].parse(source);
}
