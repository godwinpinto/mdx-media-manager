import Link from 'next/link';

const features = [
  {
    title: 'Edit on the page',
    description:
      'Hover any block of your rendered docs to insert an image, or hover an image to edit or delete it.',
  },
  {
    title: 'Real files, real source',
    description:
      'Images are cropped and converted to WebP, written to public/ (or S3), and your MDX is edited in place.',
  },
  {
    title: 'Development only',
    description:
      'Nothing ships to production: no routes, no components, no runtime. One line in your config.',
  },
  {
    title: 'Image library',
    description:
      'Browse every image, rename it everywhere, fix alt text, and find unused or broken images.',
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-20">
      <div className="max-w-2xl text-center">
        <p className="mb-3 text-sm font-medium text-fd-muted-foreground">
          For Fumadocs and MDX sites
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          Manage your docs images from the page itself
        </h1>
        <p className="mb-8 text-lg text-fd-muted-foreground">
          MDX Media Manager adds an editing overlay to your dev server. Insert, crop, replace and
          delete images where they appear, and it updates your files for you.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/docs"
            className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
          >
            Get started
          </Link>
          <Link
            href="/docs/installation"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            npx mdx-media-manager init
          </Link>
        </div>
      </div>
      <div className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-xl border bg-fd-card p-5">
            <h2 className="mb-1 font-semibold">{feature.title}</h2>
            <p className="text-sm text-fd-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
