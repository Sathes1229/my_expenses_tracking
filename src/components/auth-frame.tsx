import type { ReactNode } from 'react';

/**
 * One narrow column for signing in, setup and password pages. Top-aligned rather
 * than centred, so a phone keyboard never pushes the form off screen.
 */
export function AuthFrame({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-sm px-4 pt-8 pb-16 sm:pt-16">
      <header>
        <p className="font-semibold text-ink">My Expenses</p>
      </header>
      <main className="mt-10">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {intro && <div className="mt-2 text-muted">{intro}</div>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
