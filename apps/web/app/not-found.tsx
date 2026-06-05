import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--ft-color-surface)] px-6 py-16 text-[var(--ft-color-text)]">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ft-color-muted)]">
          Page not found
        </p>
        <h1 className="text-3xl font-semibold">This page is not available</h1>
        <p className="text-base text-[var(--ft-color-muted)]">
          The page may have moved, or the link may be incorrect.
        </p>
        <Link
          className="w-fit rounded-md bg-[var(--ft-color-accent)] px-4 py-2 text-sm font-semibold text-white"
          href="/"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
