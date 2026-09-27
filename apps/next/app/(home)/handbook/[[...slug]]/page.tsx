import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { handbook } from '@/lib/source';

/** Pages from `shared/handbook`, a content folder outside this app */
export default async function HandbookPage(props: PageProps<'/handbook/[[...slug]]'>) {
  const { slug } = await props.params;
  const page = handbook.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;

  return (
    <article className="mx-auto w-full max-w-[800px] px-4 py-12">
      <nav className="flex gap-4 text-sm text-fd-muted-foreground">
        {handbook.getPages().map((other) => (
          <Link
            key={other.url}
            href={other.url}
            className={other.url === page.url ? 'font-medium text-fd-foreground' : ''}
          >
            {other.data.title}
          </Link>
        ))}
      </nav>
      <h1 className="text-3xl font-semibold mt-6 mb-2">{page.data.title}</h1>
      <p className="text-fd-muted-foreground mb-8">{page.data.description}</p>
      <div className="prose min-w-0">
        <MDX components={getMDXComponents()} />
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return handbook.generateParams();
}

export async function generateMetadata(
  props: PageProps<'/handbook/[[...slug]]'>,
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = handbook.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
