import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { blog } from '@/lib/source';

export default async function BlogPost(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params;
  const page = blog.getPage([slug]);
  if (!page) notFound();
  const MDX = page.data.body;

  return (
    <article className="mx-auto w-full max-w-[800px] px-4 py-12">
      <Link href="/blog" className="text-sm text-fd-muted-foreground">
        ← Blog
      </Link>
      <h1 className="text-3xl font-semibold mt-4 mb-2">{page.data.title}</h1>
      <p className="text-fd-muted-foreground mb-8">{page.data.description}</p>
      <div className="prose min-w-0">
        <MDX components={getMDXComponents()} />
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return blog.getPages().map((page) => ({ slug: page.slugs[0]! }));
}

export async function generateMetadata(props: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const page = blog.getPage([slug]);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
