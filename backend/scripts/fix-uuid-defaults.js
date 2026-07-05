const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/bovogo',
  });
  await c.connect();
  await c.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  for (const table of [
    'mobile_conversations',
    'mobile_direct_messages',
    'mobile_live_locations',
  ]) {
    await c.query(
      `ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT gen_random_uuid()`,
    );
  }
  console.log('uuid defaults set');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
