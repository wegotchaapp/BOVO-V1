# Mobile schema baseline — live vs SQL vs entities

Read-only comparison, 2026-08-30. **No migrations applied, no schema altered,
no writes, no migration generated.** Supabase project `msrgmsvkuoqouohqijrp`.

Three sources compared:

- **live** — the linked Supabase database
- **sql** — `backend/migrations-applied/*.sql` (7 files, frozen)
- **entities** — `backend/src/modules/mobile-api/entities/mobile.entities.ts`
  (18 `@Entity` classes)

## Result in one line

Live matches **sql** exactly and matches **entities** exactly on every column.
The divergences are all in objects entities cannot express — foreign keys, CHECK
constraints — and in **index naming**, which is where a generated migration will
go wrong.

---

## 1. Confirmed matches

| Dimension | Scope | Result |
| --- | --- | --- |
| Tables | 18 `mobile_*` | all present; one entity class each |
| Columns | 18 tables, every column | name, type, nullability, default identical to entities |
| Primary keys | 18 | all match; `mobile_sessions` correctly keyed on `token`, not `id` |
| Unique constraints | 6 | all match `@Unique(...)` decorators |
| CHECK constraints | 9 | all match the frozen SQL |
| Indexes | 21 named `*_mobile_*` | all match the frozen SQL, including partials and `DESC NULLS LAST` |

Column spot-checks that could plausibly have drifted and did not:

| Column | Live | Entity |
| --- | --- | --- |
| `mobile_users.rating` | `numeric(3,2)` default `'5'` | `decimal(3,2)` default `5` |
| `mobile_users.name/email/password_hash` | `character varying`, no length | `@Column()` / `@Column({type:'varchar'})`, no length |
| `mobile_trips.note` | `text` NOT NULL default `''` | `text` default `''` |
| `mobile_odometer_readings.latitude` | `numeric(9,6)` nullable | `decimal(9,6)` nullable |
| `mobile_vehicles.vin` | `varchar(17)` nullable | `varchar(17)` nullable |
| `mobile_users` SSN columns | `ssn_last4 varchar(4)`, `ssn_verified bool` only | same — **no full-SSN column anywhere** |

---

## 2. Live-only — present in the database, absent from entities

These exist because the hand-written SQL created them. TypeORM cannot infer any
of them from `mobile.entities.ts`, so a **generated** migration would silently
omit every one.

### 2.1 CHECK constraints (9) — expressed in entities only as TS union types

`CHK_mobile_bookings_luggage_tier` · `CHK_mobile_bookings_amounts_nonneg` ·
`CHK_mobile_bookings_miles_order` · `CHK_mobile_odometer_kind` ·
`CHK_mobile_odometer_miles_nonneg` · `CHK_mobile_vehicles_status` ·
`CHK_mobile_vehicles_counts` · `CHK_mobile_users_bg_status` ·
`CHK_mobile_users_ssn_last4`

TypeScript unions are erased at runtime. A fresh database built from entities
alone accepts `luggage_tier = 'banana'` and a negative `insurance_premium`.

### 2.2 Foreign keys (3) — no entity declares a relation

```
mobile_deviation_events.trip_id -> mobile_trips(id)  ON DELETE CASCADE
mobile_deviation_events.user_id -> mobile_users(id)  ON DELETE CASCADE
mobile_sos_events.user_id       -> mobile_users(id)  ON DELETE CASCADE
```

No `@ManyToOne` / `@JoinColumn` exists anywhere in the entity file — every
foreign id is a plain `@Column({type:'uuid'})`. A fresh database built from
entities would lack these three cascades.

Deliberately absent, and must stay absent: `mobile_sos_events.trip_id` has no
FK, and `mobile_odometer_readings` has none at all on `trip_id`, `booking_id`,
`sailor_id`, `voyager_id`.

### 2.3 Redundant index pairs

TypeORM `@Index()` decorators and the hand-written SQL both created indexes on
the same columns, under different names. Both sets are live:

| Table | From `@Index()` | From SQL | Relationship |
| --- | --- | --- | --- |
| `mobile_bookings` | `IDX_e5006976…(trip_id)` | `IDX_mobile_bookings_trip_status(trip_id,status)` | left is a redundant prefix |
| `mobile_bookings` | `IDX_0faf3c1c…(rider_id)` | `IDX_mobile_bookings_rider_created(rider_id,created_at DESC)` | left is a redundant prefix |
| `mobile_driver_trips` | `IDX_b65815f4…(driver_id,completed_at)` | `IDX_mobile_driver_trips_completed(driver_id,completed_at DESC)` | near-duplicate, differ only in sort direction |

Not a correctness bug — a write cost on three tables. Worth one cleanup
migration, separate from the conversion, once the conversion is proven.

---

## 3. Source-only — declared but not realised in the database

### 3.1 Entity `@Index()` decorators with no matching live index

On the three newest tables, the SQL-named indexes exist but TypeORM's own
hash-named equivalents do not:

| Entity | Decorator | Live equivalent (different name) |
| --- | --- | --- |
| `MobileOdometerReading` | `@Index()` trip_id, booking_id; `@Index(['trip_id','recorded_at'])` | `IDX_mobile_odometer_trip`, `_booking`, `_trip_recorded` |
| `MobileOdometerReading` | `@Unique(['booking_id','kind'])` | `UQ_mobile_odometer_booking_kind` — a bare unique **index**, not a constraint |
| `MobileSosEvent` | `@Index()` user_id, trip_id, noonlight_alarm_id | `idx_mobile_sos_events_user`, `_trip`, `_alarm` |
| `MobileDeviationEvent` | `@Index()` trip_id, user_id | `idx_mobile_deviation_trip`, `_user` |

**This is the single highest-risk item in the conversion.** See §5.1.

### 3.2 Status columns with no CHECK

`mobile_sos_events.status` and `mobile_deviation_events.status` are plain
`varchar(20)` with a default and no constraint, while `mobile_vehicles`,
`mobile_users` and `mobile_bookings` all guard their status columns. Faithful to
the SQL, and an inconsistency worth closing later — not during the conversion.

### 3.3 Enums: none, and none should be added

13 enum types exist in `public`, all platform-side: `users_role_enum`,
`trips_status_enum`, `bookings_status_enum`, `sos_events_status_enum`,
`sos_events_trigger_type_enum`, `vehicles_category_enum`, and seven more.

**Zero `mobile_*` columns use a Postgres enum.** Every mobile status, role and
kind column is `varchar` plus an optional CHECK. Note the trap:
`sos_events_status_enum` holds exactly the four values
`MobileSosEvent.status` allows — do not be tempted to reuse it. The mobile
tables are deliberately isolated from the platform schema.

---

## 4. Ordering and dependency risks

1. **Two different UUID defaults.** Tables from the TypeORM migration use
   `uuid_generate_v4()` (needs `uuid-ossp`); tables from hand SQL use
   `gen_random_uuid()` (needs `pgcrypto`, or PG13+ core). Both extensions are
   installed here (`uuid-ossp` 1.1, `pgcrypto` 1.3) — but a fresh production
   database is not guaranteed to have them. `CREATE EXTENSION IF NOT EXISTS`
   must be the first migration in the sequence.

2. **FKs need their parents first.** `mobile_deviation_events` references both
   `mobile_trips` and `mobile_users`; `mobile_sos_events` references
   `mobile_users`. Those parents are created by
   `1746600000000-MobileApiTables.ts`, so the new migrations must sort after it.
   Timestamps above `1746600000000` are required.

3. **Eight tables have no migration at all.** `1746600000000-MobileApiTables.ts`
   creates only 10 of the 18 live `mobile_*` tables. Missing entirely:

   ```
   mobile_vehicles          mobile_odometer_readings
   mobile_ratings           mobile_sos_events
   mobile_conversations     mobile_deviation_events
   mobile_direct_messages   mobile_live_locations
   ```

   `1746284700000-ComplianceColumnsAddition.ts` touches the platform `users` and
   `profiles` tables, **not** `mobile_users` — so `checkr_candidate_id`,
   `background_check_status`, `ssn_verified`, `ssn_last4` and
   `background_check_completed_at` have no migration either.

4. **The backfill is data, and it has already run.** `vehicle_review_backfill.sql`
   flips `pending_review` vehicles to `approved`. Re-running against a database
   where ops has since rejected a vehicle is safe (the `WHERE` clause excludes
   `rejected`), but re-running against one where ops has since set something back
   to `pending_review` would auto-approve it a second time. It should not be part
   of the schema sequence.

5. **Row counts are small, so table locks are cheap today.** `mobile_users` 47,
   `mobile_sos_events` 14, `mobile_bookings` 13, `mobile_vehicles` 12,
   `mobile_trips` 7, `mobile_deviation_events` 1, `mobile_odometer_readings` 0.
   Plain `CREATE INDEX` is fine at this size; `CONCURRENTLY` is not needed and
   would force the migration out of its transaction.

---

## 5. Recommended migration sequence

### 5.1 Write these by hand. Do not run `migration:generate`.

`typeorm migration:generate` compares entity metadata against the live schema.
It does not know that `IDX_mobile_odometer_trip_recorded` is the same object the
`@Index(['trip_id','recorded_at'])` decorator asks for, because the names differ.
It will therefore emit `CREATE INDEX "IDX_<hash>"` for each one — duplicating
every index in §3.1 — and `ADD CONSTRAINT "UQ_<hash>" UNIQUE (booking_id, kind)`
alongside the existing unique index. It will also omit all 9 CHECKs and all 3
FKs, because entities cannot express them.

Write the `up()` bodies as explicit SQL taken from the frozen files.

### 5.2 The sequence

| # | Timestamp | Migration | Contents |
| --- | --- | --- | --- |
| 1 | `1746600100000` | `MobileSchemaExtensions` | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;` |
| 2 | `1746600200000` | `MobileVehiclesTable` | `mobile_vehicles` base table + `@Index()` on user_id |
| 3 | `1746600300000` | `MobileRatingsAndMessaging` | `mobile_ratings`, `mobile_conversations`, `mobile_direct_messages`, `mobile_live_locations` with their uniques |
| 4 | `1746600400000` | `MobileVehicleVerification` | `vehicle_migration.sql`: vehicle columns, VIN narrowing, `CHK_mobile_vehicles_*`, `UQ_mobile_vehicles_vin` |
| 5 | `1746600500000` | `MobileBackgroundCheck` | `vehicle_migration.sql` second half: `mobile_users` Checkr columns, `UQ_mobile_users_checkr_candidate`, `CHK_mobile_users_bg_status`, `CHK_mobile_users_ssn_last4` |
| 6 | `1746600600000` | `MobileOdometer` | `odometer_migration.sql`: `mobile_bookings` mileage columns, `mobile_odometer_readings`, its 4 indexes, 3 CHECKs |
| 7 | `1746600700000` | `MobileLuggageInsurance` | `luggage_insurance_migration.sql`: 6 booking columns, 2 CHECKs. **Omit its trailing `UPDATE`** — see §5.3 |
| 8 | `1746600800000` | `MobileSosEvents` | `mobile_sos_events` + 3 indexes + the one FK |
| 9 | `1746600900000` | `MobileRouteDeviation` | `mobile_trips.route_polyline/route_fetched_at`, `mobile_deviation_events` + 3 indexes + 2 FKs |
| 10 | `1746601000000` | `MobilePerfIndexes` | `perf_indexes.sql`: the 9 `IDX_mobile_*` indexes. Plain `CREATE INDEX`, no `CONCURRENTLY` |

Steps 2 and 3 have no source `.sql` — those tables were created outside both
systems. Derive them from the entity definitions, then diff the result against
this document before committing.

### 5.3 Data statements stay out of the schema sequence

`luggage_insurance_migration.sql` ends with an `UPDATE` that un-marks
pre-insurance bookings, and `vehicle_review_backfill.sql` is two `UPDATE`s.
Neither belongs in a `CREATE TABLE` sequence. Put them in one clearly named
data migration at the end, or run them as an operational script. Confirm with
Claude before converting the vehicle backfill at all.

### 5.4 Proving it

1. Empty database → `npm run migration:run` → dump schema → diff against §1–§3.
   Every CHECK, FK and index in this document must be present.
2. Second `migration:run` on the same database → no-op, exit 0.
3. Copy of the current database → `migration:run` → no data loss, no duplicate
   index, no constraint already-exists error.
4. Only then consider the §2.3 redundant-index cleanup, as a separate migration.

---

## Appendix — exact read-only commands

Every query below is `SELECT`-only. Run via the Supabase MCP `execute_sql` tool.

**A. Columns, types, nullability, defaults**

```sql
SELECT c.relname AS tbl, a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ,
       NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS dflt, a.attnum
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname='public' AND c.relkind='r' AND a.attnum > 0 AND NOT a.attisdropped
  AND c.relname LIKE 'mobile\_%'
ORDER BY c.relname, a.attnum;
```
→ 18 tables. Every column matched its entity property.

**B. Enums, primary keys, uniques, foreign keys, indexes**

```sql
SELECT 'enum' AS kind, t.typname AS name, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS detail, '' AS tbl
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' GROUP BY t.typname
UNION ALL
SELECT 'pkey', conname, pg_get_constraintdef(oid), conrelid::regclass::text
FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='p' AND conrelid::regclass::text LIKE 'mobile\_%'
UNION ALL
SELECT 'unique', conname, pg_get_constraintdef(oid), conrelid::regclass::text
FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='u' AND conrelid::regclass::text LIKE 'mobile\_%'
UNION ALL
SELECT 'fkey', conname, pg_get_constraintdef(oid), conrelid::regclass::text
FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f' AND conrelid::regclass::text LIKE 'mobile\_%'
UNION ALL
SELECT 'index', indexname, indexdef, tablename
FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'mobile\_%'
ORDER BY kind, tbl, name;
```
→ 13 enums (all platform-side, none on `mobile_*`), 18 PKs, 6 uniques, 3 FKs,
and the full index list including the redundant pairs in §2.3.

**C. CHECK constraints**

```sql
SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace='public'::regnamespace AND contype='c'
  AND conrelid::regclass::text LIKE 'mobile\_%';
```
→ 9 CHECKs, definitions byte-identical in meaning to the frozen SQL.

**D. Extensions and row counts**

```sql
SELECT 'extension' AS kind, extname AS name, extversion AS detail FROM pg_extension
UNION ALL SELECT 'rowcount', 'mobile_users', count(*)::text FROM mobile_users
UNION ALL SELECT 'rowcount', 'mobile_trips', count(*)::text FROM mobile_trips
UNION ALL SELECT 'rowcount', 'mobile_bookings', count(*)::text FROM mobile_bookings
UNION ALL SELECT 'rowcount', 'mobile_vehicles', count(*)::text FROM mobile_vehicles
UNION ALL SELECT 'rowcount', 'mobile_odometer_readings', count(*)::text FROM mobile_odometer_readings
UNION ALL SELECT 'rowcount', 'mobile_sos_events', count(*)::text FROM mobile_sos_events
UNION ALL SELECT 'rowcount', 'mobile_deviation_events', count(*)::text FROM mobile_deviation_events
ORDER BY kind, name;
```
→ `uuid-ossp` 1.1, `pgcrypto` 1.3, `pg_stat_statements` 1.11, `plpgsql` 1.0,
`supabase_vault` 0.3.1. Counts as listed in §4.5.

**E. Local — which tables the TypeORM migrations actually create**

```bash
grep -ohE 'CREATE TABLE (IF NOT EXISTS )?"?(mobile_[a-z_]+)"?' backend/src/database/migrations/*.ts | grep -oE 'mobile_[a-z_]+' | sort -u
```
→ 10 tables. The other 8 live tables have no migration.
