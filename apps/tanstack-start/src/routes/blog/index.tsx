import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { blog } from '@/lib/source';

export const Route = createFileRoute('/blog/')({
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto w-full max-w-[800px] px-4 py-12">
        <h1 className="text-3xl font-semibold mb-8">Blog</h1>
        <div className="flex flex-col gap-4">
          {blog.getPages().map((post) => (
            <Link
              key={post.url}
              to="/blog/$slug"
              params={{ slug: post.slugs[0]! }}
              className="rounded-xl border p-4 hover:bg-fd-accent"
            >
              <p className="font-medium">{post.data.title}</p>
              <p className="text-sm text-fd-muted-foreground">{post.data.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </HomeLayout>
  );
}
