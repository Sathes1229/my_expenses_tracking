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

/**
 * The sign-in settings the server cannot run without. Checked when auth first starts rather
 * than at import, so `next build` works without them. Errors name the key, never its value.
 */
export function authEnv(source: Env = env): { secret: string; appUrl: string } {
  const secret = source.BETTER_AUTH_SECRET;
  const appUrl = source.APP_URL;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is not set. Put a long random value in .env and restart the app.');
  }
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET is too short. Use at least 32 random characters and restart the app.');
  }
  if (!appUrl) {
    throw new Error('APP_URL is not set. Put the address people open in .env, for example http://192.168.1.10:3100, and restart the app.');
  }
  if (!URL.canParse(appUrl)) {
    throw new Error('APP_URL is not a valid address. Use the full form, for example http://192.168.1.10:3100.');
  }
  return { secret, appUrl };
}
