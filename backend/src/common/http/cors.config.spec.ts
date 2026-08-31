import { createCorsOptions, isProductionEnvironment } from './cors.config';

function allows(
  options: ReturnType<typeof createCorsOptions>,
  origin?: string,
) {
  const resolver = options.origin;
  if (typeof resolver !== 'function')
    throw new Error('Expected origin resolver');

  return new Promise<boolean>((resolve, reject) => {
    resolver(origin, (error, allowed) => {
      if (error) reject(error);
      else resolve(Boolean(allowed));
    });
  });
}

describe('CORS configuration', () => {
  it('allows only configured browser origins in production', async () => {
    const options = createCorsOptions({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://app.bovogo.com, https://admin.bovogo.com',
    });

    await expect(allows(options, 'https://app.bovogo.com')).resolves.toBe(true);
    await expect(allows(options, 'https://evil.example')).resolves.toBe(false);
    await expect(allows(options)).resolves.toBe(true);
  });

  it('fails startup if a production allowlist is absent', () => {
    expect(() => createCorsOptions({ APP_ENV: 'production' })).toThrow(
      'ALLOWED_ORIGINS or APP_URL is required in production',
    );
  });

  it('identifies either supported production environment flag', () => {
    expect(isProductionEnvironment({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionEnvironment({ APP_ENV: 'production' })).toBe(true);
    expect(isProductionEnvironment({ NODE_ENV: 'development' })).toBe(false);
  });
});
