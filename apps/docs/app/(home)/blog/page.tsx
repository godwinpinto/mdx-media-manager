import Link from 'next/link';
import { blog } from '@/lib/source';

export default function BlogIndex() {
  const posts = blog.getPages();

  return (
    <main className="mx-auto w-full max-w-[800px] px-4 py-12">
      <h1 className="text-3xl font-semibold mb-8">Blog</h1>
      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <Link key={post.url} href={post.url} className="rounded-xl border p-4 hover:bg-fd-accent">
            <p className="font-medium">{post.data.title}</p>
            <p className="text-sm text-fd-muted-foreground">{post.data.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
