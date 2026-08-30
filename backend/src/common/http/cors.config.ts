import type { CorsOptions } from 'cors';

type Environment = Record<string, string | undefined>;

export function isProductionEnvironment(
  env: Environment = process.env,
): boolean {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'production';
}

function configuredOrigins(env: Environment): string[] {
  return (env.ALLOWED_ORIGINS ?? env.APP_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Browser sessions require an explicit origin allowlist in production. Native
 * clients usually omit Origin, so they continue through normal token auth.
 */
export function createCorsOptions(env: Environment = process.env): CorsOptions {
  const production = isProductionEnvironment(env);
  const allowedOrigins = configuredOrigins(env);

  if (production && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS or APP_URL is required in production');
  }

  return {
    origin(origin, callback) {
      if (!origin || !production) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.includes(origin));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    maxAge: 3600,
  };
}
