const { Client } = require('pg');
async function main() {
  const c = new Client({
    host: 'db.msrgmsvkuoqouohqijrp.supabase.co',
    port: 5432, user: 'postgres', password: 'Wegotcha@112233',
    database: 'postgres', ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const tables = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  console.log('Supabase tables:', tables.rows.map(t => t.table_name).join(', '));
  await c.end();
}
main().catch(e => console.error(e));
