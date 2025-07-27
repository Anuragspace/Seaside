-- Performance optimization indexes for OAuth2 authentication system

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Indexes for oauth_providers table
CREATE INDEX IF NOT EXISTS idx_oauth_providers_user_id ON oauth_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider ON oauth_providers(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider_id ON oauth_providers(provider_id);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_expires_at ON oauth_providers(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_providers_created_at ON oauth_providers(created_at);

-- Indexes for refresh_tokens table
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(revoked);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_created_at ON refresh_tokens(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider_provider_id ON oauth_providers(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash_revoked_expires ON refresh_tokens(token_hash, revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, active);
CREATE INDEX IF NOT EXISTS idx_users_username_active ON users(username, active);