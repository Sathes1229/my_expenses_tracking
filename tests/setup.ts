import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Each worker gets its own temp database file, migrated once before its tests run.
const dir = mkdtempSync(join(tmpdir(), 'my-expenses-test-'));
process.env.DATABASE_PATH = join(dir, 'test.db');
process.env.UPLOADS_DIR = join(dir, 'uploads');
// Fixed values for tests only; the app refuses to start auth without real ones.
process.env.BETTER_AUTH_SECRET = 'test-only-secret-0123456789abcdef0123456789';
process.env.APP_URL = 'http://localhost:3100';
process.env.OWNER_RESET_TOKEN = '';

const { runMigrations } = await import('@/db/migrate');
runMigrations();
