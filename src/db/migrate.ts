import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client';

export function runMigrations(): void {
  migrate(db, { migrationsFolder: './drizzle' });
}
