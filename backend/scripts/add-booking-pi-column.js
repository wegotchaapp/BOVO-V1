const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/bovogo',
  });
  await c.connect();
  await c.query(
    `ALTER TABLE mobile_bookings ADD COLUMN IF NOT EXISTS payment_intent_id varchar(64)`,
  );
  await c.query(
    `ALTER TABLE mobile_bookings ALTER COLUMN status SET DEFAULT 'pending'`,
  );
  console.log('mobile_bookings payment_intent_id ready');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
