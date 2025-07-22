# Deployment Guide

## Environment Setup

### Development
```bash
cp .env.example .env
```

```env
VITE_OAUTH2_GOOGLE_CLIENT_ID=your_google_client_id
VITE_OAUTH2_GITHUB_CLIENT_ID=your_github_client_id
VITE_API_BASE_URL=http://localhost:8080
```

### Production
```env
VITE_OAUTH2_GOOGLE_CLIENT_ID=production_google_client_id
VITE_OAUTH2_GITHUB_CLIENT_ID=production_github_client_id
VITE_API_BASE_URL=https://your-production-api.com
```

## OAuth2 Provider Setup

### Google
1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth2 credentials
2. Authorized origins: `https://yourdomain.com`
3. Redirect URIs: `https://yourdomain.com/auth/callback`

### GitHub
1. [GitHub Settings](https://github.com/settings/developers) → New OAuth App
2. Callback URL: `https://yourdomain.com/auth/callback`

## Build Commands
```bash
npm run build      # Production build
npm run preview    # Test build locally
npm test          # Run tests
```

## Deployment Platforms

### Vercel
1. Connect GitHub repo
2. Set environment variables in dashboard
3. Build: `npm run build`, Output: `dist`

### Netlify
1. Connect GitHub repo
2. Set environment variables
3. Add `_redirects`: `/*    /index.html   200`

### Docker
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

## Security Checklist
- [ ] OAuth2 redirect URIs configured
- [ ] HTTPS enabled
- [ ] Debug mode disabled in production
- [ ] Source maps disabled
- [ ] CORS configured on backend

## Troubleshooting
- **OAuth2 redirect errors**: Check exact URI match
- **Env vars not loading**: Ensure `VITE_` prefix
- **API connection issues**: Verify CORS and URL accessibility