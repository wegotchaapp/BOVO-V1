const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/bovogo',
  });
  await c.connect();
  await c.query(`
    ALTER TABLE mobile_trips
    ADD COLUMN IF NOT EXISTS start_video_url text,
    ADD COLUMN IF NOT EXISTS started_at timestamptz
  `);
  console.log('mobile_trips start video columns ready');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
