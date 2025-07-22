# Security Features

## Password Security
- bcrypt hashing (cost 10)
- Requirements: 8+ chars, uppercase, lowercase, digit, special char
- Reserved usernames blocked (admin, root, etc.)

## JWT Tokens
- **Access**: 15 minutes, API auth
- **Refresh**: 7 days, token renewal
- HMAC-SHA256 signing
- Hashed storage, one-time use

## Input Validation
- Email/username format validation
- SQL injection prevention
- XSS protection via HTML escaping
- Control character removal

## OAuth2 Security
- CSRF protection with state parameter
- IP-bound state validation
- 10-minute state expiration
- Automatic cleanup

## Rate Limiting
- Auth endpoints: 5/min per IP
- OAuth state: 10/min per IP
- Room creation: 10/min per IP

## Environment Variables
```env
JWT_SECRET=secure-random-32-char-minimum
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Security Checklist
- ✅ bcrypt password hashing
- ✅ JWT token security
- ✅ Input validation/sanitization
- ✅ OAuth2 CSRF protection
- ✅ Rate limiting
- ✅ SQL injection prevention
- ✅ XSS prevention