# Authentication System

## Overview
Custom OAuth2 authentication supporting email/password and OAuth2 providers (Google, GitHub).

## Core Components
- **AuthService** - API calls and token management
- **AuthContext** - React state management
- **TokenManager** - Secure localStorage handling
- **ProtectedRoute** - Route protection

## Environment Variables
```env
VITE_OAUTH2_GOOGLE_CLIENT_ID=your_google_client_id
VITE_OAUTH2_GITHUB_CLIENT_ID=your_github_client_id
VITE_API_BASE_URL=https://your-backend-api.com
VITE_DEBUG_AUTH=true  # Optional debug mode
```

## Usage Examples

### Basic Auth
```tsx
const { user, isAuthenticated, signIn, signOut } = useAuth();

await signIn({ email: 'user@example.com', password: 'password' });
```

### OAuth2
```tsx
await signInWithOAuth('google');  // or 'github'
```

### Protected Routes
```tsx
<Route path="/private" element={
  <ProtectedRoute><PrivatePage /></ProtectedRoute>
} />
```

## Security Features
- JWT tokens with auto-refresh
- CSRF protection for OAuth2
- Secure localStorage storage
- Route protection with redirects

## API Endpoints
- `POST /auth/signin` - Email/password auth
- `POST /auth/signup` - User registration
- `POST /auth/refresh` - Token refresh
- `GET /auth/me` - Current user
- `POST /auth/oauth2/callback` - OAuth2 callback

## Troubleshooting
- **OAuth2 redirect issues**: Check provider redirect URI config
- **Token refresh failing**: Verify API endpoint accessibility
- **State not persisting**: Check localStorage availability