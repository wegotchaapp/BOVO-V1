-- Mock Supabase auth schema for local development
CREATE SCHEMA IF NOT EXISTS auth;

-- Mock uid() function - returns current_setting('app.current_user_id')::uuid
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
