-- Mobile-side SOS records.
--
-- The platform's sos_events.user_id is a foreign key onto `users`, and the
-- mobile auth layer is isolated with its own `mobile_users` (47 rows, zero id
-- overlap), so a mobile SOS could never be written there. This is its
-- equivalent, and it gives a Noonlight callback something to correlate against.
--
-- Additive and re-runnable.

CREATE TABLE IF NOT EXISTS mobile_sos_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
  trip_id             uuid,
  status              varchar(20) NOT NULL DEFAULT 'active',
  latitude            double precision,
  longitude           double precision,
  noonlight_alarm_id  varchar(100),
  contact_notified    boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_sos_events_user      ON mobile_sos_events (user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_sos_events_trip      ON mobile_sos_events (trip_id);
-- The webhook looks alarms up by this, on every callback.
CREATE INDEX IF NOT EXISTS idx_mobile_sos_events_alarm     ON mobile_sos_events (noonlight_alarm_id);
