import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-col flex-1 justify-center px-4 py-8 text-center">
        <h1 className="font-medium text-xl mb-4">Lorem Ipsum Docs (TanStack Start)</h1>
        <div className="flex justify-center gap-3">
          <Link
            to="/docs/$"
            params={{
              _splat: '',
            }}
            className="px-3 py-2 rounded-lg bg-fd-primary text-fd-primary-foreground font-medium text-sm"
          >
            Open Docs
          </Link>
          <Link to="/blog" className="px-3 py-2 rounded-lg border font-medium text-sm">
            Blog
          </Link>
        </div>
      </div>
    </HomeLayout>
  );
}
