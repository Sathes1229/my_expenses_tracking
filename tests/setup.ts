import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Each worker gets its own temp database file, migrated once before its tests run.
const dir = mkdtempSync(join(tmpdir(), 'my-expenses-test-'));
process.env.DATABASE_PATH = join(dir, 'test.db');
process.env.UPLOADS_DIR = join(dir, 'uploads');

const { runMigrations } = await import('@/db/migrate');
runMigrations();
