-- ==========================================================
-- WeGotcha: Complete PostgreSQL Schema (Supabase Compatible)
-- ==========================================================

-- 0. EXTENSIONS & SETUP
-- ==========================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. ENUMS
-- ==========================================================
CREATE TYPE user_role AS ENUM ('user', 'premium_user', 'driver', 'ts_agent', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'failed', 'requires_input');
CREATE TYPE bg_check_status AS ENUM ('pending', 'clear', 'consider', 'adverse');
CREATE TYPE trip_status AS ENUM ('posted', 'booked', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'en_route', 'completed', 'cancelled', 'declined');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');
CREATE TYPE incident_severity AS ENUM ('P0', 'P1', 'P2');
CREATE TYPE incident_category AS ENUM ('sexual_misconduct', 'weapons_threat', 'criminal_allegations', 'unsafe_driving', 'harassment', 'discrimination', 'vehicle_condition', 'no_show', 'route_fraud', 'minor_dispute');
CREATE TYPE moderation_action_type AS ENUM ('dismiss', 'warning', 'temp_suspension', 'permanent_ban', 'law_enforcement_referral');
CREATE TYPE sos_status AS ENUM ('active', 'false_alarm', 'dispatched', 'resolved');
CREATE TYPE sos_trigger_type AS ENUM ('button', 'volume_sequence', 'unsafe_feeling');
CREATE TYPE notification_channel AS ENUM ('push', 'email', 'sms', 'in_app');
CREATE TYPE notification_status AS ENUM ('sent', 'delivered', 'read', 'failed');

-- 2. IDENTITY & AUTH
-- ==========================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    role user_role DEFAULT 'user',
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    stripe_account_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT users_dob_check CHECK (dob <= (NOW() - INTERVAL '18 years')::date)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    device_info JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token VARCHAR(255) NOT NULL,
    device_id VARCHAR(100),
    platform VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'stripe_identity',
    provider_reference VARCHAR(255),
    status verification_status DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE kyc_documents_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50),
    storage_url VARCHAR(500),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    relationship VARCHAR(50),
    opted_in BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 3. PROFILES & VEHICLES
-- ==========================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    bio VARCHAR(500),
    profile_photo_url VARCHAR(500),
    languages VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
    rating_avg DECIMAL(3,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    trust_score DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    music_pref VARCHAR(50),
    chat_pref VARCHAR(50),
    smoking_pref VARCHAR(50),
    pets_pref VARCHAR(50),
    notifications JSONB DEFAULT '{"push": true, "email": true, "sms": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    color VARCHAR(30),
    license_plate VARCHAR(20),
    state VARCHAR(5),
    category VARCHAR(50),
    max_luggage_class VARCHAR(20),
    max_passengers INT DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE vehicle_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    photo_type VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE vehicle_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL,
    storage_url VARCHAR(500),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 4. TRIPS & BOOKINGS
-- ==========================================================
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    origin_metro VARCHAR(100) NOT NULL,
    dest_metro VARCHAR(100) NOT NULL,
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    seats_total INT NOT NULL CHECK (seats_total <= 7),
    seats_available INT NOT NULL,
    per_seat_price DECIMAL(6,2) NOT NULL,
    status trip_status DEFAULT 'posted',
    notes VARCHAR(300),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE trip_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    zone_type VARCHAR(20) NOT NULL, -- 'pickup' or 'dropoff'
    metro_name VARCHAR(100),
    zone_polygon GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE trip_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    conversation_style VARCHAR(30),
    music VARCHAR(30),
    smoking VARCHAR(30),
    pets VARCHAR(30),
    women_only BOOLEAN DEFAULT FALSE,
    luggage_capacity VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    rider_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seats INT NOT NULL,
    total_price DECIMAL(6,2) NOT NULL,
    insurance_opted_in BOOLEAN DEFAULT FALSE,
    status booking_status DEFAULT 'pending',
    payment_intent_id VARCHAR(255),
    payout_transfer_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE booking_luggage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    quantity INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE booking_status_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by UUID NOT NULL,
    reason VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 5. PAYMENTS & INSURANCE
-- ==========================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount DECIMAL(6,2) NOT NULL,
    stripe_payment_intent VARCHAR(255),
    status payment_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    amount DECIMAL(6,2) NOT NULL,
    stripe_transfer_id VARCHAR(255),
    status payout_status DEFAULT 'pending',
    scheduled_for TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    amount DECIMAL(6,2) NOT NULL,
    stripe_refund_id VARCHAR(255),
    reason VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    policy_ref VARCHAR(255),
    premium DECIMAL(6,2),
    coverage_start TIMESTAMPTZ,
    coverage_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 6. SAFETY & SOS
-- ==========================================================
CREATE TABLE trip_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    accuracy_meters INT,
    battery_level INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE sos_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_type sos_trigger_type NOT NULL,
    status sos_status DEFAULT 'active',
    location GEOGRAPHY(Point, 4326),
    dispatched_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    severity incident_severity NOT NULL,
    category incident_category NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    category incident_category NOT NULL,
    description TEXT NOT NULL,
    severity incident_severity DEFAULT 'P2',
    status VARCHAR(30) DEFAULT 'open',
    evidence_photo_url VARCHAR(500),
    sla_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    taken_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type moderation_action_type NOT NULL,
    reason TEXT NOT NULL,
    evidence_refs TEXT[] DEFAULT ARRAY[]::TEXT[],
    suspension_days INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    moderation_action_id UUID REFERENCES moderation_actions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Append-only audit log
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. COMMUNICATION & NOTIFICATIONS
-- ==========================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    participant_ids UUID[] NOT NULL,
    last_message VARCHAR(500),
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content VARCHAR(2000) NOT NULL,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_category VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    caller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    twilio_ref VARCHAR(255),
    duration_seconds INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    delivery_status notification_status DEFAULT 'sent',
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 8. INDEXES
-- ==========================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_verifications_user ON verifications(user_id);
CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);

CREATE INDEX idx_profiles_user ON profiles(user_id);
CREATE INDEX idx_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX idx_vehicle_photos_vehicle ON vehicle_photos(vehicle_id);

CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_route ON trips(origin_metro, dest_metro);
CREATE INDEX idx_trips_date ON trips(departure_date);
CREATE INDEX idx_trip_zones_trip ON trip_zones(trip_id);
CREATE INDEX idx_trip_zones_polygon ON trip_zones USING GIST(zone_polygon);
CREATE INDEX idx_trip_prefs_trip ON trip_preferences(trip_id);

CREATE INDEX idx_bookings_trip ON bookings(trip_id);
CREATE INDEX idx_bookings_rider ON bookings(rider_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_booking_luggage_booking ON booking_luggage(booking_id);
CREATE INDEX idx_booking_log_booking ON booking_status_log(booking_id);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payouts_driver ON payouts(driver_id);
CREATE INDEX idx_insurance_booking ON insurance_policies(booking_id);

CREATE INDEX idx_trip_pings_booking ON trip_pings(booking_id);
CREATE INDEX idx_trip_pings_location ON trip_pings USING GIST(location);
CREATE INDEX idx_sos_user ON sos_events(user_id);
CREATE INDEX idx_sos_booking ON sos_events(booking_id);
CREATE INDEX idx_incidents_reporter ON incidents(reporter_id);
CREATE INDEX idx_reports_category ON reports(category);
CREATE INDEX idx_reports_severity ON reports(severity);
CREATE INDEX idx_reports_sla ON reports(sla_deadline) WHERE status = 'open';
CREATE INDEX idx_moderation_report ON moderation_actions(report_id);
CREATE INDEX idx_suspensions_user ON suspensions(user_id);
CREATE INDEX idx_audit_actor ON audit_events(actor_id);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);

CREATE INDEX idx_conversations_booking ON conversations(booking_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_call_records_booking ON call_records(booking_id);
CREATE INDEX idx_notification_user ON notification_log(user_id);
CREATE INDEX idx_notification_status ON notification_log(delivery_status);

-- 9. AUTOMATIC UPDATED_AT TRIGGERS
-- ==========================================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name != 'audit_events'
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t);
    END LOOP;
END $$;

-- 10. TRIP COST CALCULATION FUNCTION
-- ==========================================================
CREATE OR REPLACE FUNCTION calculate_trip_cost(
    base_price DECIMAL,
    seats INT,
    luggage_qty INT DEFAULT 0,
    luggage_rate DECIMAL DEFAULT 3.00,
    insurance BOOLEAN DEFAULT FALSE,
    insurance_cost DECIMAL DEFAULT 5.00,
    platform_fee_pct DECIMAL DEFAULT 0.05
)
RETURNS TABLE (
    base_total DECIMAL,
    luggage_total DECIMAL,
    insurance_total DECIMAL,
    subtotal DECIMAL,
    platform_fee DECIMAL,
    total DECIMAL
)
LANGUAGE plpgsql AS $$
BEGIN
    base_total := base_price * seats;
    luggage_total := luggage_qty * luggage_rate;
    insurance_total := CASE WHEN insurance THEN insurance_cost ELSE 0 END;
    subtotal := base_total + luggage_total + insurance_total;
    platform_fee := subtotal * platform_fee_pct;
    total := subtotal + platform_fee;
    RETURN NEXT;
END;
$$;

-- 11. ROW LEVEL SECURITY (RLS)
-- ==========================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_luggage ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Helper function for RLS (matches Supabase auth.uid())
CREATE OR REPLACE FUNCTION is_owner_or_admin(user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
    SELECT auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ts_agent')
    );
$$;

-- User Policies
CREATE POLICY "Users view own" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users insert own" ON users FOR INSERT WITH CHECK (id = auth.uid());

-- Profile Policies
CREATE POLICY "Profiles public read" ON profiles FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Profiles owner write" ON profiles FOR ALL USING (user_id = auth.uid());

-- Vehicle Policies
CREATE POLICY "Vehicles public read active" ON vehicles FOR SELECT USING (is_active AND deleted_at IS NULL);
CREATE POLICY "Vehicles owner write" ON vehicles FOR ALL USING (driver_id = auth.uid());

-- Trip Policies
CREATE POLICY "Trips public read active" ON trips FOR SELECT USING (status != 'cancelled' AND deleted_at IS NULL);
CREATE POLICY "Trips driver write" ON trips FOR ALL USING (driver_id = auth.uid());

-- Booking Policies
CREATE POLICY "Bookings participant read" ON bookings FOR SELECT USING (rider_id = auth.uid() OR EXISTS (SELECT 1 FROM trips WHERE id = bookings.trip_id AND driver_id = auth.uid()));
CREATE POLICY "Bookings rider create" ON bookings FOR INSERT WITH CHECK (rider_id = auth.uid());

-- SOS & Safety
CREATE POLICY "SOS user read/write" ON sos_events FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'ts_agent')));
CREATE POLICY "Incidents participant read" ON incidents FOR SELECT USING (reporter_id = auth.uid());

-- Audit Log (Append-only: No UPDATE, No DELETE)
CREATE POLICY "Audit log select" ON audit_events FOR SELECT USING (true);
CREATE POLICY "Audit log insert" ON audit_events FOR INSERT WITH CHECK (true);

-- Generalized policies for remaining tables
CREATE POLICY "User data isolation" ON emergency_contacts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "User data isolation" ON user_preferences FOR ALL USING (user_id = auth.uid());
CREATE POLICY "User data isolation" ON notification_log FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Driver data isolation" ON payouts FOR ALL USING (driver_id = auth.uid());
CREATE POLICY "Driver data isolation" ON payments FOR SELECT USING (user_id = auth.uid());

-- Message policies
CREATE POLICY "Conversations participant access" ON conversations FOR SELECT USING (auth.uid() = ANY(participant_ids));
CREATE POLICY "Messages conversation access" ON messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND auth.uid() = ANY(participant_ids))
);
CREATE POLICY "Messages sender insert" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Trip Pings
CREATE POLICY "Pings participant access" ON trip_pings FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE id = trip_pings.booking_id AND (rider_id = auth.uid() OR EXISTS (SELECT 1 FROM trips WHERE id = bookings.trip_id AND driver_id = auth.uid())))
);
CREATE POLICY "Pings owner insert" ON trip_pings FOR INSERT WITH CHECK (user_id = auth.uid());
