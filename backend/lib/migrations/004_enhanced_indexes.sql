-- 004_enhanced_indexes.sql
-- Enhanced performance indexes and constraints for OAuth2 authentication system

-- ============================
-- Additional indexes for users table
-- ============================

CREATE INDEX IF NOT EXISTS idx_users_provider_provider_id ON users(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_email_active_verified ON users(email, active, email_verified);
CREATE INDEX IF NOT EXISTS idx_users_username_active_deleted ON users(username, active, deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_active ON users(last_login, active);

-- Partial indexes with immutable WHERE clauses only
CREATE INDEX IF NOT EXISTS idx_users_active_email_verified ON users(email)
WHERE active = true AND email_verified = true;

CREATE INDEX IF NOT EXISTS idx_users_oauth_providers ON users(provider_id)
WHERE provider != 'email';

-- ============================
-- Additional indexes for oauth_providers table
-- ============================

CREATE INDEX IF NOT EXISTS idx_oauth_providers_user_provider ON oauth_providers(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_expires_at_provider ON oauth_providers(expires_at, provider);

-- ============================
-- Additional indexes for refresh_tokens table
-- ============================

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expires_revoked ON refresh_tokens(user_id, expires_at, revoked);

-- ============================
-- Add constraints for data integrity safely
-- ============================

-- Email format constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_format'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_email_format 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
END;
$$;

-- Allowed provider values on users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_provider_values'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_provider_values 
        CHECK (provider IN ('email', 'google', 'github'));
    END IF;
END;
$$;

-- Allowed provider values on oauth_providers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_oauth_provider_values'
    ) THEN
        ALTER TABLE oauth_providers ADD CONSTRAINT chk_oauth_provider_values 
        CHECK (provider IN ('google', 'github'));
    END IF;
END;
$$;

-- Password hash constraint for OAuth users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_password_oauth'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_password_oauth 
        CHECK (
            (provider = 'email' AND password_hash != '') OR 
            (provider != 'email' AND password_hash = '')
        );
    END IF;
END;
$$;

-- ============================
-- Utility Functions
-- ============================

-- Cleanup expired tokens (keep in manual or cron-based tasks, not in index predicates)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP OR revoked = true;
    DELETE FROM oauth_providers WHERE expires_at < CURRENT_TIMESTAMP;
    RAISE NOTICE 'Expired tokens cleanup completed at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Update user last_login
CREATE OR REPLACE FUNCTION update_user_last_login(user_id_param INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Get user statistics
CREATE OR REPLACE FUNCTION get_user_statistics()
RETURNS TABLE(
    total_users BIGINT,
    active_users BIGINT,
    verified_users BIGINT,
    oauth_users BIGINT,
    email_users BIGINT,
    recent_logins BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE active = true) as active_users,
        COUNT(*) FILTER (WHERE email_verified = true) as verified_users,
        COUNT(*) FILTER (WHERE provider != 'email') as oauth_users,
        COUNT(*) FILTER (WHERE provider = 'email') as email_users,
        COUNT(*) FILTER (WHERE last_login > CURRENT_TIMESTAMP - INTERVAL '7 days') as recent_logins
    FROM users
    WHERE deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;