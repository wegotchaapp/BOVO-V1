const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/bovogo',
  });
  await c.connect();
  await c.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await c.query(`
    ALTER TABLE mobile_users
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS languages text,
      ADD COLUMN IF NOT EXISTS emergency_name varchar(120),
      ADD COLUMN IF NOT EXISTS emergency_phone varchar(32),
      ADD COLUMN IF NOT EXISTS photo_url text,
      ADD COLUMN IF NOT EXISTS ride_preferences text
  `);

  await c.query(`
    CREATE TABLE IF NOT EXISTS mobile_vehicles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      make varchar(60) NOT NULL,
      model varchar(60) NOT NULL,
      year int NOT NULL,
      color varchar(40) NOT NULL,
      license_plate varchar(20) NOT NULL,
      state varchar(2) NOT NULL DEFAULT 'TX',
      vin varchar(32),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS mobile_vehicles_user_idx ON mobile_vehicles (user_id)
  `);

  await c.query(`
    CREATE TABLE IF NOT EXISTS mobile_ratings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL,
      rater_id uuid NOT NULL,
      ratee_id uuid NOT NULL,
      score int NOT NULL,
      comment text,
      tags text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS mobile_ratings_booking_rater_uniq
    ON mobile_ratings (booking_id, rater_id)
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS mobile_ratings_ratee_idx ON mobile_ratings (ratee_id)
  `);

  console.log('profile/vehicles/ratings schema ready');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
