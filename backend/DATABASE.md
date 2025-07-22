# Database Management

## Quick Commands
```bash
# Database operations
./dbmanager.sh migrate    # Run migrations
./dbmanager.sh seed      # Add test data
./dbmanager.sh health    # Check status
./dbmanager.sh backup    # Create backup
./dbmanager.sh cleanup   # Remove old data
```

## Schema
- **users** - User accounts and profiles
- **oauth_providers** - OAuth2 tokens
- **refresh_tokens** - JWT session tokens

## Environment
```bash
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
BACKUP_DIR=backups  # Optional
```

## Migration Files
- `001_initial_schema.sql` - Core tables
- `002_add_indexes.sql` - Performance indexes
- `003_seed_data.sql` - Test data

## Health Check Response
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "response_time_ms": 15
  },
  "tables": [{"name": "users", "row_count": 1250}]
}
```

## Security Features
- bcrypt password hashing
- Hashed refresh token storage
- Automatic token cleanup
- Secure backup handling

## Troubleshooting
- **Migration fails**: Check connectivity and syntax
- **Backup fails**: Verify pg_dump and credentials
- **Health warnings**: Monitor slow queries and connections