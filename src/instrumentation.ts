/** Next calls this once when the server starts (never during `next build`), before routes run. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { mkdirSync } = await import('node:fs');
    const { recordSocketAddresses } = await import('@/lib/socket-address');
    const { runMigrations } = await import('@/db/migrate');
    const { env } = await import('@/lib/env');

    recordSocketAddresses();
    // A fresh install or an update needs no manual database step.
    runMigrations();
    mkdirSync(env.UPLOADS_DIR, { recursive: true });
  }
}
