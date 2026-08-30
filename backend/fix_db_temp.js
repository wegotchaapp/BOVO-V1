const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run this maintenance script.');
}

const client = new Client({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  try {
    const contentCol = await client.query(
      "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'trip_replies' AND column_name = 'content'",
    );
    if (contentCol.rows.length > 0) {
      console.log('Found content column, nullable:', contentCol.rows[0].is_nullable);
      const nullCount = await client.query(
        "SELECT COUNT(*) as cnt FROM trip_replies WHERE content IS NULL",
      );
      console.log('NULL count:', nullCount.rows[0].cnt);
      await client.query("UPDATE trip_replies SET content = '' WHERE content IS NULL");
      if (contentCol.rows[0].is_nullable === 'YES') {
        await client.query(
          'ALTER TABLE trip_replies ALTER COLUMN content SET NOT NULL',
        );
        console.log('Set NOT NULL');
      }
    } else {
      console.log('No content column in trip_replies');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});
