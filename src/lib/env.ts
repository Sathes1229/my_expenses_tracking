import { z } from 'zod';

// Empty strings count as unset, so `.env.example` can list every key with no value.
const optional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().optional(),
);
const withDefault = (fallback: string) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().default(fallback));

const schema = z.object({
  DATABASE_PATH: withDefault('./data/app.db'),
  UPLOADS_DIR: withDefault('./data/uploads'),
  BETTER_AUTH_SECRET: optional,
  APP_URL: optional,
  ANTHROPIC_API_KEY: optional,
  OPENAI_API_KEY: optional,
  DEEPSEEK_API_KEY: optional,
  OWNER_RESET_TOKEN: optional,
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return schema.parse(source);
}

export const env: Env = loadEnv();
