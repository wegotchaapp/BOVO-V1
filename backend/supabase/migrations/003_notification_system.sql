-- ==========================================================
-- WeGotcha: Notification System Enhancements
-- ==========================================================

-- 1. NOTIFICATION PREFERENCES TABLE
-- ==========================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- 2. ADD TIMEZONE COLUMN TO DEVICES
-- ==========================================================
ALTER TABLE devices ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- 3. ENHANCE NOTIFICATION LOG INDEXES
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_category ON notification_log(category);
CREATE INDEX IF NOT EXISTS idx_notification_log_unread ON notification_log(user_id, is_read) WHERE is_read = false;

-- 4. ROW LEVEL SECURITY
-- ==========================================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notification preferences owner access" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- Notification log: user can read their own logs
CREATE POLICY "Notification log owner read" ON notification_log
    FOR SELECT USING (user_id = auth.uid());

-- 5. NOTIFICATION LOG UPDATED_AT TRIGGER
-- ==========================================================
CREATE TRIGGER set_updated_at_notification_log
    BEFORE UPDATE ON notification_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
