import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '@/lib/env';
import * as schema from './schema';

function open() {
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
  const sqlite = new Database(env.DATABASE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle({ client: sqlite, schema });
}

type Db = ReturnType<typeof open>;
let instance: Db | undefined;

/**
 * Opened on first use rather than at import, so `next build` (which imports this module) creates
 * no database file. Methods run with the proxy as `this` and read their fields through it.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    instance ??= open();
    return Reflect.get(instance, property);
  },
});
