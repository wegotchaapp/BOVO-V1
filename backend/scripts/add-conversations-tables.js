const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5432/bovogo',
  });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS mobile_conversations (
      id uuid PRIMARY KEY,
      user_low_id uuid NOT NULL,
      user_high_id uuid NOT NULL,
      last_message text,
      last_message_at timestamptz,
      trip_label text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await c.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS mobile_conversations_pair_uniq
    ON mobile_conversations (user_low_id, user_high_id)
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS mobile_conversations_low_idx
    ON mobile_conversations (user_low_id)
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS mobile_conversations_high_idx
    ON mobile_conversations (user_high_id)
  `);
  await c.query(`
    CREATE TABLE IF NOT EXISTS mobile_direct_messages (
      id uuid PRIMARY KEY,
      conversation_id uuid NOT NULL,
      sender_id uuid NOT NULL,
      text text NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS mobile_direct_messages_conv_idx
    ON mobile_direct_messages (conversation_id)
  `);
  await c.query(`
    CREATE INDEX IF NOT EXISTS mobile_direct_messages_sender_idx
    ON mobile_direct_messages (sender_id)
  `);
  console.log('mobile_conversations + mobile_direct_messages ready');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
