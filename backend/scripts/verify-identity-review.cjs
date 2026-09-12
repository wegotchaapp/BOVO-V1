/* Run only after building and migrating an EMPTY disposable local database:
 * DATABASE_URL=postgresql://postgres@127.0.0.1:55441/bovogo_identity_proof DATABASE_SSL=false node scripts/verify-identity-review.cjs
 * Exercises real Nest guards, the production JWT strategy, PostgreSQL transactions and local private storage.
 */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port !== '5432' && url.pathname === '/bovogo_identity_proof', 'Only the named disposable localhost database is allowed');
const { AppDataSource: db } = require('../dist/database/data-source');
const { Test } = require('@nestjs/testing');
const { PassportModule } = require('@nestjs/passport');
const { JwtService } = require('@nestjs/jwt');
const { ConfigService } = require('@nestjs/config');
const { DataSource } = require('typeorm');
const { IdentityReviewController } = require('../dist/modules/admin/identity-review.controller');
const { IdentityReviewService } = require('../dist/modules/admin/identity-review.service');
const { AdminGuard } = require('../dist/modules/admin/admin.guard');
const { JwtStrategy } = require('../dist/modules/auth/jwt.strategy');
const { PrivateMediaService } = require('../dist/modules/private-media/private-media.service');
const { User } = require('../dist/database/entities/user.entity');
const { MobileUser, MobileIdentityVerification } = require('../dist/modules/mobile-api/entities/mobile.entities');
const { AuditEvent } = require('../dist/database/entities/audit.entity');
const secret = 'identity-proof-only-' + randomUUID();
const fixturePrefix = 'identity-proof-' + randomUUID();
const keys = [];
let app;
let assertions = 0;
const pass = label => { assertions++; console.log('PASS ' + label); };
const media = new PrivateMediaService(new ConfigService({ AWS_ACCESS_KEY_ID: 'placeholder' }));

async function main() {
  db.logger = new (require('../dist/database/private-query.logger').PrivateQueryLogger)(false);
  await db.initialize();
  assert.equal((await db.query('SELECT count(*)::int AS n FROM mobile_identity_verifications'))[0].n, 0, 'Identity table must be empty');
  const users = db.getRepository(User);
  const mobile = db.getRepository(MobileUser);
  const submissions = db.getRepository(MobileIdentityVerification);
  const admin = await users.save(users.create({ name: 'Proof admin', email: fixturePrefix + '-admin@example.invalid', role: 'admin' }));
  const member = await users.save(users.create({ name: 'Proof member', email: fixturePrefix + '-member@example.invalid', role: 'user' }));
  const jwt = new JwtService({ secret });
  const adminToken = jwt.sign({ sub: admin.id }, { expiresIn: '5m' });
  const memberToken = jwt.sign({ sub: member.id }, { expiresIn: '5m' });
  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [IdentityReviewController],
    providers: [IdentityReviewService, AdminGuard, { provide: DataSource, useValue: db },
      { provide: PrivateMediaService, useValue: media },
      { provide: JwtStrategy, useFactory: () => new JwtStrategy(users, new ConfigService({ JWT_SECRET: secret })) }],
  }).compile();
  app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl();
  async function request(path = '', token = adminToken, method = 'GET', body) {
    return fetch(origin + '/admin/identity-verifications' + path, {
      method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function fixture(verified = false) {
    const user = await mobile.save(mobile.create({ name: 'Proof applicant', email: fixturePrefix + '-' + randomUUID() + '@example.invalid', password_hash: 'test-only', is_verified: verified }));
    const key = fixturePrefix + '/' + user.id;
    keys.push(key + '/front', key + '/selfie');
    await media.put(key + '/front', Buffer.from('synthetic front image'), 'image/jpeg');
    await media.put(key + '/selfie', Buffer.from('synthetic selfie image'), 'image/png');
    const row = await submissions.save(submissions.create({ user_id: user.id, document_type: 'passport', id_front_key: key + '/front', selfie_key: key + '/selfie' }));
    return { user, row };
  }
  const a = await fixture();
  for (const [path, method] of [['', 'GET'], ['/' + a.row.id, 'GET'], ['/' + a.row.id + '/files/id_front', 'GET'], ['/' + a.row.id + '/approve', 'POST'], ['/' + a.row.id + '/reject', 'POST']]) {
    assert.equal((await request(path, '', method)).status, 401);
    assert.equal((await request(path, memberToken, method)).status, 403);
  }
  assert.equal((await request('', 'invalid-token')).status, 401);
  assert.equal((await request('', jwt.sign({ sub: admin.id }, { expiresIn: -1 }))).status, 401);
  assert.equal((await request('', new JwtService({ secret: 'wrong' }).sign({ sub: admin.id }))).status, 401);
  pass('All five routes reject missing JWT (401) and non-admin (403); invalid, expired and forged tokens rejected');

  const queue = await (await request()).json();
  assert.equal(queue.verifications.length, 1);
  assert.equal(queue.verifications[0].ownerName, 'Proof applicant');
  assert(!JSON.stringify(queue).includes(fixturePrefix + '/'));
  assert(!JSON.stringify(queue).includes('_key'));
  const detail = await (await request('/' + a.row.id)).json();
  assert.deepEqual(detail.verification.files, { id_front: true, id_back: false, selfie: true });
  assert(!JSON.stringify(detail).includes('_key'));
  assert(!JSON.stringify(detail).includes(a.row.id_front_key));
  assert.equal((await request('?status=invalid')).status, 400);
  assert.equal((await request('?page=0')).status, 400);
  assert.equal((await request('?page=abc')).status, 400);
  assert.equal((await request('/' + randomUUID())).status, 404);
  pass('Queue/detail expose allowlisted metadata only, validate status/page and return 404 for missing submissions');

  for (const slot of ['invalid', '__proto__', 'toString', 'id_back']) assert.equal((await request('/' + a.row.id + '/files/' + slot)).status, 404);
  const image = await request('/' + a.row.id + '/files/id_front');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('cache-control'), 'no-store');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.equal(await image.text(), 'synthetic front image');
  const viewed = await db.getRepository(AuditEvent).findOneByOrFail({ entity_id: a.row.id, action: 'mobile_identity.file_viewed' });
  assert.equal(viewed.actor_id, admin.id);
  assert.deepEqual(viewed.metadata, { slot: 'id_front' });
  await media.remove(a.row.selfie_key);
  assert.equal((await request('/' + a.row.id + '/files/selfie')).status, 404);
  pass('Private image streaming, no-store, audit of viewer and slot, unknown/absent/missing image 404');

  for (const note of [undefined, '', '   ', 123, {}, 'a'.repeat(501)]) assert.equal((await request('/' + a.row.id + '/reject', adminToken, 'POST', note === undefined ? {} : { note })).status, 400);
  assert.equal((await request('/' + a.row.id + '/approve', adminToken, 'POST')).status, 201);
  let reviewed = await submissions.findOneByOrFail({ id: a.row.id });
  assert.equal(reviewed.status, 'approved'); assert.equal(reviewed.reviewed_by, admin.id); assert(reviewed.reviewed_at);
  assert.equal((await mobile.findOneByOrFail({ id: a.user.id })).is_verified, true);
  assert.equal((await request('/' + a.row.id + '/reject', adminToken, 'POST', { note: 'too late' })).status, 409);
  assert.equal((await request('/' + a.row.id + '/approve', adminToken, 'POST')).status, 409);
  pass('Reject requires 1–500 characters; approval atomically verifies the user; reviewed submissions return 409');

  for (const verified of [false, true]) {
    const b = await fixture(verified);
    assert.equal((await request('/' + b.row.id + '/reject', adminToken, 'POST', { note: '  Please retake the photo.  ' })).status, 201);
    reviewed = await submissions.findOneByOrFail({ id: b.row.id });
    assert.equal(reviewed.status, 'rejected'); assert.equal(reviewed.review_note, 'Please retake the photo.');
    assert.equal((await mobile.findOneByOrFail({ id: b.user.id })).is_verified, verified);
    assert.equal(await db.getRepository(AuditEvent).countBy({ entity_id: b.row.id, action: 'mobile_identity.rejected' }), 1);
  }
  pass('Rejection trims the note, records an audit and preserves both false and true verified flags');

  const c = await fixture();
  const race = await Promise.all([request('/' + c.row.id + '/approve', adminToken, 'POST'), request('/' + c.row.id + '/reject', adminToken, 'POST', { note: 'Conflicting review' })]);
  assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
  assert.equal(await db.getRepository(AuditEvent).countBy({ entity_id: c.row.id }), 1);
  pass('Concurrent approve/reject: exactly one commits, the other gets 409, with one audit event');

  const d = await fixture();
  await assert.rejects(submissions.insert({ user_id: d.user.id, document_type: 'passport', id_front_key: 'synthetic', selfie_key: 'synthetic' }), e => e.code === '23505');
  await assert.rejects(db.query("UPDATE mobile_identity_verifications SET status = 'invalid' WHERE id = $1", [d.row.id]), e => e.code === '23514');
  await assert.rejects(db.query("UPDATE mobile_identity_verifications SET document_type = 'invalid' WHERE id = $1", [d.row.id]), e => e.code === '23514');
  pass('Database enforces one pending submission and both status/document CHECK constraints');

  await db.query(`CREATE FUNCTION identity_proof_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`);
  await db.query(`CREATE TRIGGER identity_proof_fail_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION identity_proof_fail_audit()`);
  try {
    assert.equal((await request('/' + d.row.id + '/approve', adminToken, 'POST')).status, 500);
    assert.equal((await submissions.findOneByOrFail({ id: d.row.id })).status, 'pending_review');
    assert.equal((await mobile.findOneByOrFail({ id: d.user.id })).is_verified, false);
    assert.equal((await request('/' + d.row.id + '/files/id_front')).status, 500);
  } finally {
    await db.query('DROP TRIGGER identity_proof_fail_audit ON audit_events');
    await db.query('DROP FUNCTION identity_proof_fail_audit()');
  }
  pass('Failed audit rolls back approval and user verification; failed view audit does not disclose image bytes');

  const client = db.createQueryRunner();
  await client.connect();
  try {
    await client.query('CREATE ROLE identity_proof_client NOLOGIN');
    await client.query('GRANT USAGE ON SCHEMA public TO identity_proof_client');
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON mobile_identity_verifications TO identity_proof_client');
    await client.query('SET ROLE identity_proof_client');
    assert.equal((await client.query('SELECT count(*)::int AS n FROM mobile_identity_verifications'))[0].n, 0);
    assert.equal((await client.query("UPDATE mobile_identity_verifications SET status = 'approved' RETURNING id"))[1], 0);
    await assert.rejects(client.query("INSERT INTO mobile_identity_verifications(user_id, document_type, id_front_key, selfie_key) VALUES (gen_random_uuid(), 'passport', 'synthetic', 'synthetic')"), e => e.code === '42501');
    assert.equal((await client.query('DELETE FROM mobile_identity_verifications RETURNING id'))[1], 0);
  } finally {
    await client.query('RESET ROLE');
    await client.query('DROP OWNED BY identity_proof_client');
    await client.query('DROP ROLE identity_proof_client');
    await client.release();
  }
  pass('RLS denies client reads/inserts/updates/deletes even when a client is accidentally granted table privileges');
  const migrations = await db.query('SELECT name FROM migrations ORDER BY timestamp');
  console.log('Migration count:', migrations.length);
  console.log('Public table count:', (await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'"))[0].n);
  console.log('Identity indexes:', (await db.query("SELECT indexname FROM pg_indexes WHERE tablename='mobile_identity_verifications' ORDER BY indexname")).map(r => r.indexname).join(', '));
  console.log(`${assertions} integration groups passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (app) await app.close();
  for (const key of keys) await media.remove(key);
  if (db.isInitialized) {
    // Delete only this script's synthetic fixture records, never unrelated rows.
    await db.query('DELETE FROM audit_events WHERE entity_id IN (SELECT id::text FROM mobile_identity_verifications WHERE user_id IN (SELECT id FROM mobile_users WHERE email LIKE $1))', [fixturePrefix + '%']);
    await db.query('DELETE FROM mobile_identity_verifications WHERE user_id IN (SELECT id FROM mobile_users WHERE email LIKE $1)', [fixturePrefix + '%']);
    await db.query('DELETE FROM mobile_users WHERE email LIKE $1', [fixturePrefix + '%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', [fixturePrefix + '%']);
    await db.destroy();
  }
});
