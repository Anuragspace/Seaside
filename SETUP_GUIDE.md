# Setup Guide - OAuth2 Authentication

## Prerequisites
- Node.js (v18+), Go (v1.21+), Git

## Database Setup (NeonDB)
1. Create account at [neon.tech](https://neon.tech)
2. Get connection string from dashboard
3. Add to `backend/.env`:
   ```bash
   DATABASE_URL=postgresql://user:pass@endpoint.region.aws.neon.tech/db?sslmode=require
   ```

## OAuth2 Setup

### Google
1. [Google Cloud Console](https://console.cloud.google.com) → Create OAuth2 credentials
2. Authorized origins: `http://localhost:3000`, `https://yourdomain.com`
3. Redirect URIs: `http://localhost:3000/auth/callback/google`

### GitHub
1. [GitHub Settings](https://github.com/settings/developers) → New OAuth App
2. Callback URL: `http://localhost:3000/auth/callback/github`

## Environment Files

**backend/.env:**
```bash
DATABASE_URL=your_neon_connection_string
JWT_SECRET=your_secure_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
FRONTEND_URL=http://localhost:3000
```

**frontend/.env:**
```bash
VITE_OAUTH2_GOOGLE_CLIENT_ID=your_google_client_id
VITE_OAUTH2_GITHUB_CLIENT_ID=your_github_client_id
VITE_API_BASE_URL=http://localhost:8080
```

## Database Setup
```bash
cd backend
chmod +x dbmanager.sh
./dbmanager.sh migrate
./dbmanager.sh seed  # Optional test data
```

## Run Application
```bash
# Backend
cd backend && go run main.go

# Frontend
cd frontend && npm install && npm run dev
```

## Test Setup
- Visit `http://localhost:3000`
- Test email/password and OAuth2 sign-in
- Check `./dbmanager.sh health`

## Troubleshooting
- **Database issues**: Check connection string and run `./dbmanager.sh health`
- **OAuth2 issues**: Verify redirect URLs match exactly
- **CORS errors**: Check FRONTEND_URL in backend/.env
