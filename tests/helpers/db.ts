import { getTableName, isTable } from 'drizzle-orm';
import { db } from '@/db/client';
import * as schema from '@/db/schema';

/** Empties every app table. Foreign keys are switched off while deleting, so order is irrelevant. */
export async function resetDb(): Promise<void> {
  db.$client.pragma('foreign_keys = OFF');
  try {
    for (const table of Object.values(schema).filter(isTable)) {
      db.$client.prepare(`delete from "${getTableName(table)}"`).run();
    }
  } finally {
    db.$client.pragma('foreign_keys = ON');
  }
}
