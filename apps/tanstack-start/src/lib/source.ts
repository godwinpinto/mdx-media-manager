import { llms, loader } from 'fumadocs-core/source';
import { defineCollections, defineDocs } from 'fumadocs-mdx/macro';
import { pageSchema } from 'fumadocs-core/source/schema';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { docsRoute } from './shared';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [lucideIconsPlugin()],
});

// A second collection: blog posts at /blog/<slug>
const blogPosts = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: pageSchema,
});

export const blog = loader({
  baseUrl: '/blog',
  source: blogPosts.toFumadocsSource(),
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
