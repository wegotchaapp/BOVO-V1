const { Client } = require('pg');
async function main() {
  const c = new Client({
    host: 'db.msrgmsvkuoqouohqijrp.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'Wegotcha@112233',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query('SELECT current_database() as db, version() as ver');
  console.log('Connected to:', r.rows[0].db);

  const tables = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  console.log('Existing tables:', tables.rows.map(t => t.table_name).join(', '));

  await c.end();
}
main().catch(e => console.error('Error:', e.message));
