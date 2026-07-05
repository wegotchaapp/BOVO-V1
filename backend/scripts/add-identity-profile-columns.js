const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/bovogo',
  });
  await c.connect();
  await c.query(`
    ALTER TABLE mobile_users
      ADD COLUMN IF NOT EXISTS notification_settings text,
      ADD COLUMN IF NOT EXISTS oauth_provider varchar(20),
      ADD COLUMN IF NOT EXISTS oauth_subject varchar(128),
      ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz
  `);
  console.log('identity/profile columns ready');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
