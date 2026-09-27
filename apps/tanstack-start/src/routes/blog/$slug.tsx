import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { useMDXComponents } from '@/components/mdx';
import { baseOptions } from '@/lib/layout.shared';
import { blog } from '@/lib/source';

export const Route = createFileRoute('/blog/$slug')({
  component: BlogPost,
  loader: ({ params }) => {
    if (!blog.getPage([params.slug])) throw notFound();
    return { slug: params.slug };
  },
});

function BlogPost() {
  const { slug } = Route.useLoaderData();
  const page = blog.getPage([slug])!;
  const MDX = page.data.body;

  return (
    <HomeLayout {...baseOptions()}>
      <article className="mx-auto w-full max-w-[800px] px-4 py-12">
        <Link to="/blog" className="text-sm text-fd-muted-foreground">
          ← Blog
        </Link>
        <h1 className="text-3xl font-semibold mt-4 mb-2">{page.data.title}</h1>
        <p className="text-fd-muted-foreground mb-8">{page.data.description}</p>
        <div className="prose min-w-0">
          <MDX components={useMDXComponents()} />
        </div>
      </article>
    </HomeLayout>
  );
}
