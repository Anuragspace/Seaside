-- Seed data for development and testing
-- This file contains sample data for development environment

-- Only run seed data in development environment
DO $$
BEGIN
    IF current_setting('server_version_num')::int >= 90600 THEN
        -- Check if we're in development (this is a simple check)
        IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com') THEN
            -- Insert comprehensive test users (passwords are hashed versions of 'password123')
            INSERT INTO users (email, username, password_hash, provider, email_verified, active, avatar_url, last_login) VALUES
            ('admin@example.com', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'email', true, true, 'https://example.com/avatars/admin.jpg', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
            ('user1@example.com', 'user1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'email', true, true, 'https://example.com/avatars/user1.jpg', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
            ('user2@example.com', 'user2', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'email', false, true, NULL, NULL),
            ('inactive@example.com', 'inactive_user', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'email', true, false, NULL, CURRENT_TIMESTAMP - INTERVAL '30 days'),
            ('testuser@gmail.com', 'googleuser', '', 'google', true, true, 'https://lh3.googleusercontent.com/a/default-user', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
            ('testuser@github.com', 'githubuser', '', 'github', true, true, 'https://avatars.githubusercontent.com/u/123456', CURRENT_TIMESTAMP - INTERVAL '1 day'),
            ('newuser@example.com', 'newuser', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'email', false, true, NULL, NULL),
            ('testgoogle2@gmail.com', 'googleuser2', '', 'google', true, true, 'https://lh3.googleusercontent.com/a/another-user', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
            ('testgithub2@github.com', 'githubuser2', '', 'github', true, true, 'https://avatars.githubusercontent.com/u/654321', CURRENT_TIMESTAMP - INTERVAL '2 days');

            -- Insert sample OAuth providers for testing
            INSERT INTO oauth_providers (user_id, provider, provider_id, access_token, refresh_token, expires_at) VALUES
            (5, 'google', '123456789', 'ya29.sample_google_access_token_12345', 'sample_google_refresh_token_12345', CURRENT_TIMESTAMP + INTERVAL '1 hour'),
            (6, 'github', '987654321', 'gho_sample_github_access_token_67890', 'sample_github_refresh_token_67890', CURRENT_TIMESTAMP + INTERVAL '1 hour'),
            (8, 'google', '111222333', 'ya29.sample_google_access_token_33333', 'sample_google_refresh_token_33333', CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
            (9, 'github', '444555666', 'gho_sample_github_access_token_66666', 'sample_github_refresh_token_66666', CURRENT_TIMESTAMP + INTERVAL '2 hours'),
            -- Add some expired tokens for testing cleanup
            (5, 'google', '123456789_old', 'ya29.expired_google_token', 'expired_google_refresh', CURRENT_TIMESTAMP - INTERVAL '1 hour');

            -- Insert sample refresh tokens for testing
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked) VALUES
            (1, 'hash_admin_token_12345', CURRENT_TIMESTAMP + INTERVAL '7 days', false),
            (2, 'hash_user1_token_67890', CURRENT_TIMESTAMP + INTERVAL '7 days', false),
            (3, 'hash_user2_token_11111', CURRENT_TIMESTAMP + INTERVAL '7 days', false),
            (5, 'hash_google_token_22222', CURRENT_TIMESTAMP + INTERVAL '7 days', false),
            (6, 'hash_github_token_33333', CURRENT_TIMESTAMP + INTERVAL '7 days', false),
            -- Add some expired/revoked tokens for testing cleanup
            (1, 'hash_expired_token_44444', CURRENT_TIMESTAMP - INTERVAL '1 day', false),
            (2, 'hash_revoked_token_55555', CURRENT_TIMESTAMP + INTERVAL '5 days', true);

            RAISE NOTICE 'Development seed data inserted successfully';
        ELSE
            RAISE NOTICE 'Seed data already exists, skipping insertion';
        END IF;
    END IF;
END $$;

-- Note: In production, this seed data should not be used
-- This is only for development and testing purposes
-- The seed data includes various user states for comprehensive testing:
-- - Active verified users
-- - Unverified users  
-- - Inactive users
-- - OAuth users (Google, GitHub)
-- - Users with and without avatars
-- - Recent and old login timestamps
-- - Valid and expired tokens