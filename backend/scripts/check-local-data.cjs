const { Client } = require('pg');
async function main() {
  // Check local DB data
  const local = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/wegotcha' });
  await local.connect();
  const tables = await local.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  console.log('Local tables:', tables.rows.map(t => t.table_name).join(', '));
  for (const t of tables.rows) {
    const cnt = await local.query(`SELECT COUNT(*)::int as c FROM "${t.table_name}"`);
    console.log(`  ${t.table_name}: ${cnt.rows[0].c} rows`);
  }
  await local.end();
}
main().catch(e => console.error(e));
