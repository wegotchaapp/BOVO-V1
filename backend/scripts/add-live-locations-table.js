const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/bovogo',
  });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS mobile_live_locations (
      id uuid PRIMARY KEY,
      trip_id uuid NOT NULL,
      user_id uuid NOT NULL,
      role varchar(12) NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      heading double precision,
      speed double precision,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS mobile_live_locations_trip_user_uniq
    ON mobile_live_locations (trip_id, user_id)
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS mobile_live_locations_trip_idx
    ON mobile_live_locations (trip_id)
  `);
  console.log('mobile_live_locations ready');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
