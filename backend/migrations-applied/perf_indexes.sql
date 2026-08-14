-- Bovogo — item 15 part 2: indexes for the hot read paths.
-- Additive and re-runnable. Tables are small today, so plain CREATE INDEX is
-- fast; once live, prefer CREATE INDEX CONCURRENTLY (which cannot run inside a
-- transaction block).

-- ── mobile_trips ─────────────────────────────────────────────────────────────
-- The adventure feed: WHERE status='active' ORDER BY departure_at.
-- Partial, because no other status is ever browsed.
CREATE INDEX IF NOT EXISTS "IDX_mobile_trips_active_departure"
  ON "mobile_trips" ("departure_at")
  WHERE "status" = 'active';

-- Route search. TypeORM emits ILIKE with no wildcards (case-insensitive
-- equality), so a lower() expression index is what actually gets used.
CREATE INDEX IF NOT EXISTS "IDX_mobile_trips_route_active"
  ON "mobile_trips" (lower("from_city"), lower("to_city"), "departure_at")
  WHERE "status" = 'active';

-- "My adventures" for a Voyager, newest first.
CREATE INDEX IF NOT EXISTS "IDX_mobile_trips_driver_departure"
  ON "mobile_trips" ("driver_id", "departure_at");

-- ── mobile_bookings ──────────────────────────────────────────────────────────
-- Manifest, seat counts and trip completion all filter trip_id + status.
CREATE INDEX IF NOT EXISTS "IDX_mobile_bookings_trip_status"
  ON "mobile_bookings" ("trip_id", "status");

-- A Sailor's own bookings, newest first.
CREATE INDEX IF NOT EXISTS "IDX_mobile_bookings_rider_created"
  ON "mobile_bookings" ("rider_id", "created_at" DESC);

-- ── mobile_direct_messages ───────────────────────────────────────────────────
-- Threads are always read in chronological order for one conversation.
CREATE INDEX IF NOT EXISTS "IDX_mobile_dm_conversation_created"
  ON "mobile_direct_messages" ("conversation_id", "created_at");

-- ── mobile_conversations ─────────────────────────────────────────────────────
-- Inbox ordering.
CREATE INDEX IF NOT EXISTS "IDX_mobile_conversations_last_message"
  ON "mobile_conversations" ("last_message_at" DESC NULLS LAST);

-- ── mobile_sessions ──────────────────────────────────────────────────────────
-- Expiry sweeps. Token lookups already ride the primary key.
CREATE INDEX IF NOT EXISTS "IDX_mobile_sessions_expires"
  ON "mobile_sessions" ("expires_at");

-- ── mobile_driver_trips ──────────────────────────────────────────────────────
-- Earnings summary: driver + period.
CREATE INDEX IF NOT EXISTS "IDX_mobile_driver_trips_completed"
  ON "mobile_driver_trips" ("driver_id", "completed_at" DESC);

-- Planner needs fresh statistics to actually choose these.
ANALYZE "mobile_trips";
ANALYZE "mobile_bookings";
ANALYZE "mobile_direct_messages";
ANALYZE "mobile_conversations";
ANALYZE "mobile_sessions";
ANALYZE "mobile_driver_trips";

SELECT tablename, indexname FROM pg_indexes
 WHERE schemaname='public' AND indexname LIKE 'IDX_mobile_%'
 ORDER BY tablename, indexname;
