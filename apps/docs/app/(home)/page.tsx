import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">Lorem Ipsum Docs</h1>
      <p className="flex justify-center gap-4">
        <Link href="/docs" className="font-medium underline">
          Docs
        </Link>
        <Link href="/blog" className="font-medium underline">
          Blog
        </Link>
        <Link href="/handbook" className="font-medium underline">
          Handbook
        </Link>
      </p>
    </div>
  );
}
