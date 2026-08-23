-- Route geometry and deviation records for the mobile adventure path.
--
-- Deviation detection previously existed only on the platform side, ran against
-- `trips` (0 rows), and could never have worked anyway: it asked Mapbox for the
-- distance to the nearest road rather than the distance from the trip's own
-- route, and sent one coordinate to an endpoint that requires two.
--
-- The route is stored per adventure so the per-ping maths needs no network call.
-- Additive and re-runnable.

ALTER TABLE mobile_trips
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS route_fetched_at timestamptz;

CREATE TABLE IF NOT EXISTS mobile_deviation_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES mobile_trips(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
  latitude      double precision NOT NULL,
  longitude     double precision NOT NULL,
  distance_miles double precision NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_deviation_trip ON mobile_deviation_events (trip_id);
CREATE INDEX IF NOT EXISTS idx_mobile_deviation_user ON mobile_deviation_events (user_id);
-- Used to suppress repeat alerts while a driver stays off-route.
CREATE INDEX IF NOT EXISTS idx_mobile_deviation_recent ON mobile_deviation_events (trip_id, created_at DESC);
