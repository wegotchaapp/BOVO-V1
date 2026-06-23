-- ==========================================================
-- WeGotcha: Chat Tables & Supabase Realtime RLS Policies
-- ==========================================================

-- 1. CHAT TABLES (TypeORM entity-aligned names)
-- ==========================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    participant_ids UUID[] NOT NULL,
    last_message VARCHAR(500),
    last_message_sender_id UUID,
    last_message_at TIMESTAMPTZ,
    unread_count_driver INT DEFAULT 0,
    unread_count_rider INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content VARCHAR(2000) NOT NULL,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_category VARCHAR(50),
    requires_review BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_user_id)
);

CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment VARCHAR(500),
    tags VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
    is_released BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE(booking_id, rater_id)
);

CREATE TABLE IF NOT EXISTS call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    caller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    twilio_call_sid VARCHAR(255),
    duration_seconds INT,
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEXES
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_chat_conv_booking ON chat_conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_created ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_msg_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_block_users ON chat_blocks(blocker_id, blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_rating_booking ON ratings(booking_id);
CREATE INDEX IF NOT EXISTS idx_rating_rated ON ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_call_booking ON call_records(booking_id);

-- 3. UPDATED_AT TRIGGERS
-- ==========================================================
CREATE TRIGGER set_updated_at_chat_conv
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ratings
    BEFORE UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. ROW LEVEL SECURITY
-- ==========================================================
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

-- Chat Conversations: participants can read
CREATE POLICY "Conversations participant read" ON chat_conversations
    FOR SELECT USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "Conversations participant insert" ON chat_conversations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = booking_id
            AND (b.rider_id = auth.uid() OR EXISTS (
                SELECT 1 FROM trips t WHERE t.id = b.trip_id AND t.driver_id = auth.uid()
            ))
        )
    );

-- Chat Messages: participants can read, sender can insert
CREATE POLICY "Messages participant read" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = conversation_id AND auth.uid() = ANY(c.participant_ids)
        )
    );

CREATE POLICY "Messages sender insert" ON chat_messages
    FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Chat Blocks: user can manage their own blocks
CREATE POLICY "Blocks owner manage" ON chat_blocks
    FOR ALL USING (blocker_id = auth.uid());

-- Ratings: participants can read released ratings, rater can insert
CREATE POLICY "Ratings released read" ON ratings
    FOR SELECT USING (
        is_released = TRUE
        OR rater_id = auth.uid()
        OR rated_user_id = auth.uid()
    );

CREATE POLICY "Ratings participant insert" ON ratings
    FOR INSERT WITH CHECK (
        rater_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = booking_id
            AND (b.rider_id = auth.uid() OR EXISTS (
                SELECT 1 FROM trips t WHERE t.id = b.trip_id AND t.driver_id = auth.uid()
            ))
        )
    );

-- Call Records: participants can read their own call records
CREATE POLICY "Call records participant read" ON call_records
    FOR SELECT USING (caller_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Call records insert" ON call_records
    FOR INSERT WITH CHECK (caller_id = auth.uid());

-- 5. SUPABASE REALTIME PUBLICATIONS
-- ==========================================================
-- Enable Realtime for chat tables so clients can subscribe to live changes

-- Drop existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication with all chat-related tables
CREATE PUBLICATION supabase_realtime FOR TABLE
    chat_conversations,
    chat_messages,
    chat_blocks,
    ratings,
    call_records;

-- Enable Realtime on each table (required for Supabase dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE ratings;
ALTER PUBLICATION supabase_realtime ADD TABLE call_records;

-- 6. AUTOMATED MESSAGE NOTIFICATION TRIGGER (Realtime-compatible)
-- ==========================================================
-- This trigger updates conversation metadata when a new message is inserted,
-- which fires a Realtime event that the mobile app can listen to.

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the conversation's last_message and timestamp
    UPDATE chat_conversations
    SET last_message = NEW.content,
        last_message_sender_id = NEW.sender_id,
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;

    -- Increment unread count for the other participant
    UPDATE chat_conversations
    SET unread_count_rider = CASE
            WHEN (SELECT participant_ids[1] FROM chat_conversations WHERE id = NEW.conversation_id) = NEW.sender_id
            THEN unread_count_rider + 1
            ELSE unread_count_rider
        END,
        unread_count_driver = CASE
            WHEN (SELECT participant_ids[1] FROM chat_conversations WHERE id = NEW.conversation_id) != NEW.sender_id
            THEN unread_count_driver + 1
            ELSE unread_count_driver
        END
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_message();
