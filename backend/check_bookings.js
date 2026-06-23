const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect().then(async () => {
  const r = await c.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns 
    WHERE table_name = 'bookings' ORDER BY ordinal_position`);
  console.log('bookings columns:');
  r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type}) nullable=${row.is_nullable}`));
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
