import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * `scripts/write-deploy-env.cjs` is what decides whether production runs with
 * a real secret or with the placeholder committed to `.env.example`. It runs
 * once per deploy, in CI, where nobody reads its output — so its failure modes
 * are exercised here instead.
 *
 * The script is a `.cjs` file outside `rootDir`, so it is run as a child
 * process rather than imported.
 */
const repoBackend = path.resolve(__dirname, '../../..');
const script = path.join(repoBackend, 'scripts', 'write-deploy-env.cjs');
const template = path.join(repoBackend, '.env.example');

function run(
  contents: string,
  env: NodeJS.ProcessEnv,
): { ok: boolean; output: string; written: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bovogo-deploy-env-'));
  const target = path.join(dir, '.env');
  fs.writeFileSync(target, contents);

  try {
    execFileSync(process.execPath, [script, target], {
      env: { PATH: process.env.PATH, ...env },
      stdio: 'pipe',
    });
    return { ok: true, output: '', written: fs.readFileSync(target, 'utf8') };
  } catch (error: any) {
    return {
      ok: false,
      output: String(error.stderr ?? error.message),
      written: fs.readFileSync(target, 'utf8'),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Reads one of the writer's key lists out of the script's source. */
function readList(declaration: string): string[] {
  return fs
    .readFileSync(script, 'utf8')
    .split(declaration)[1]
    .split('];')[0]
    .split('\n')
    .map((line) => line.trim().match(/^'([A-Z][A-Z0-9_]*)',$/)?.[1] ?? '')
    .filter(Boolean);
}

const requiredKeys = readList('const requiredKeys = [');

/** A template declaring every required key, so only the env is ever at issue. */
const fullTemplate = `${requiredKeys.map((key) => `${key}=placeholder`).join('\n')}\n`;

/** Every required key supplied with a value the writer accepts. */
function fullEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    requiredKeys.map((key) => [
      key,
      key === 'TWILIO_WEBHOOK_BASE_URL'
        ? 'https://api.bovogo.app'
        : `value-for-${key}`,
    ]),
  );
}

describe('deployment .env writer', () => {
  it('substitutes a managed value without disturbing the rest of the file', () => {
    const result = run(
      'JWT_SECRET=placeholder\nLOG_LEVEL=debug\n# a comment\n',
      { JWT_SECRET: 'from-ci' },
    );

    expect(result.ok).toBe(true);
    expect(result.written).toBe(
      'JWT_SECRET="from-ci"\nLOG_LEVEL=debug\n# a comment\n',
    );
  });

  it('leaves an unmanaged key alone even when the CI env defines it', () => {
    const result = run('SOME_OTHER_KEY=placeholder\n', {
      SOME_OTHER_KEY: 'from-ci',
    });

    expect(result.ok).toBe(true);
    expect(result.written).toBe('SOME_OTHER_KEY=placeholder\n');
  });

  it('quotes a value containing newlines and delimiters rather than corrupting the file', () => {
    const result = run('JWT_SECRET=placeholder\nLOG_LEVEL=debug\n', {
      JWT_SECRET: 'line1\nLOG_LEVEL=trace\n"quoted"\\',
    });

    expect(result.ok).toBe(true);
    // A single physical line, so the injected `LOG_LEVEL=trace` is data.
    expect(result.written.split('\n')).toHaveLength(3);
    expect(result.written).toContain('LOG_LEVEL=debug');
  });

  it('fails when the CI env carries a managed key the template never declares', () => {
    const result = run('LOG_LEVEL=debug\n', {
      STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_from_ci',
    });

    expect(result.ok).toBe(false);
    expect(result.output).toContain('STRIPE_CONNECT_WEBHOOK_SECRET');
    // An unwritten secret must not be half-applied.
    expect(result.written).toBe('LOG_LEVEL=debug\n');
  });

  it.each([
    'TRUST_PROXY_HOPS',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_CONNECT_WEBHOOK_SECRET',
    'STRIPE_IDENTITY_WEBHOOK_SECRET',
    'TWILIO_WEBHOOK_BASE_URL',
  ])('fails rather than writing a blank %s over the placeholder', (key) => {
    const result = run(`${key}=placeholder\n`, { [key]: '' });

    expect(result.ok).toBe(false);
    expect(result.output).toContain(key);
    expect(result.written).toBe(`${key}=placeholder\n`);
  });

  // Production mode is derived from the CI environment, never from the file
  // being written: `.env.example` ships APP_ENV=development, so the template
  // can't be the thing that decides how strictly it is checked.
  describe('production mode', () => {
    it.each([
      ['APP_ENV', { APP_ENV: 'production' }],
      ['NODE_ENV', { NODE_ENV: 'production' }],
    ])('rejects a required key that is absent entirely when %s marks production', (_label, marker) => {
      // The failure this catches is silent: an unmapped key leaves the
      // `.env.example` placeholder, so the deploy goes green and production
      // verifies webhooks against `whsec_your-platform-webhook-secret`.
      const result = run(fullTemplate, {
        ...marker,
        JWT_SECRET: 'from-ci',
      });

      expect(result.ok).toBe(false);
      expect(result.output).toContain('STRIPE_CONNECT_WEBHOOK_SECRET');
      expect(result.output).toContain('TWILIO_WEBHOOK_BASE_URL');
      expect(result.written).toBe(fullTemplate);
    });

    it('rejects a required key that is present but blank in production', () => {
      const result = run(fullTemplate, {
        ...fullEnv(),
        APP_ENV: 'production',
        STRIPE_WEBHOOK_SECRET: '   ',
      });

      expect(result.ok).toBe(false);
      expect(result.output).toContain('STRIPE_WEBHOOK_SECRET');
      expect(result.written).toBe(fullTemplate);
    });

    it('writes when every required key is present and non-blank', () => {
      const result = run(fullTemplate, { ...fullEnv(), APP_ENV: 'production' });

      expect(result.ok).toBe(true);
      expect(result.written).toContain('APP_ENV="production"');
      expect(result.written).toContain('JWT_SECRET="value-for-JWT_SECRET"');
      expect(result.written).not.toContain('placeholder');
    });

    it('still writes a partial env outside production', () => {
      // Local `.env` bootstrapping supplies one key at a time; only a
      // production deploy has to account for the whole set.
      const result = run(fullTemplate, { JWT_SECRET: 'from-ci' });

      expect(result.ok).toBe(true);
      expect(result.written).toContain('JWT_SECRET="from-ci"');
      expect(result.written).toContain('DATABASE_URL=placeholder');
    });
  });

  describe('TWILIO_WEBHOOK_BASE_URL is an origin and nothing else', () => {
    // canonicalWebhookUrl concatenates this with the request path, so anything
    // beyond scheme + host rebuilds a URL Twilio never signed — which fails
    // every genuine callback. A `https://*` prefix check accepts all of these.
    it.each([
      ['a trailing path', 'https://api.bovogo.app/hooks'],
      ['a query string', 'https://api.bovogo.app?x=1'],
      ['a fragment', 'https://api.bovogo.app#f'],
      ['userinfo credentials', 'https://user:pass@api.bovogo.app'],
      ['surrounding whitespace', ' https://api.bovogo.app '],
      ['a value that is not a URL', 'api.bovogo.app'],
      ['a plain http origin in production', 'http://api.bovogo.app'],
    ])('rejects %s', (_label, value) => {
      const result = run(fullTemplate, {
        ...fullEnv(),
        APP_ENV: 'production',
        TWILIO_WEBHOOK_BASE_URL: value,
      });

      expect(result.ok).toBe(false);
      expect(result.output).toContain('TWILIO_WEBHOOK_BASE_URL');
      // Deploy logs are public; the message names the key, never the value.
      expect(result.output).not.toContain('api.bovogo.app');
      expect(result.written).toBe(fullTemplate);
    });

    it('accepts the template default outside production', () => {
      // .env.example ships http://localhost:3000 for local development.
      const result = run('TWILIO_WEBHOOK_BASE_URL=placeholder\n', {
        TWILIO_WEBHOOK_BASE_URL: 'http://localhost:3000',
      });

      expect(result.ok).toBe(true);
      expect(result.written).toBe(
        'TWILIO_WEBHOOK_BASE_URL="http://localhost:3000"\n',
      );
    });

    it.each(['https://api.bovogo.app', 'https://api.bovogo.app/'])(
      'accepts the bare origin %s',
      (value) => {
        // The guard strips trailing slashes before appending the path, so one
        // here is harmless and must not fail a deploy.
        const result = run(fullTemplate, {
          ...fullEnv(),
          APP_ENV: 'production',
          TWILIO_WEBHOOK_BASE_URL: value,
        });

        expect(result.ok).toBe(true);
        expect(result.written).toContain(
          `TWILIO_WEBHOOK_BASE_URL=${JSON.stringify(value)}`,
        );
      },
    );
  });

  it('declares every key the deploy plumbs through in .env.example', () => {
    // The script refuses to write when a managed key is missing from the
    // template, so a name added to one side and not the other breaks the
    // deploy at the worst possible moment.
    const managed = readList('const managedKeys = [');

    const declared = new Set(
      fs
        .readFileSync(template, 'utf8')
        .split('\n')
        .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1] ?? '')
        .filter(Boolean),
    );

    expect(managed.length).toBeGreaterThan(0);
    expect(managed.filter((key) => !declared.has(key))).toEqual([]);
  });
});
