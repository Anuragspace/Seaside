# Database Management System

This document describes the comprehensive database management system for the OAuth2 authentication migration project.

## Overview

The database management system provides:
- **Migration Management**: Automated schema migrations with rollback support
- **Seed Data**: Development and testing data with comprehensive scenarios
- **Backup & Recovery**: Compressed backups with validation and metadata
- **Health Monitoring**: Detailed health checks and performance metrics
- **Maintenance**: Automated cleanup and monitoring

## Components

### 1. Migration System

#### Features
- Automatic migration tracking and execution
- SQL-based migrations with transaction support
- Migration status reporting
- Basic rollback functionality

#### Migration Files
- `001_initial_schema.sql` - Core authentication tables
- `002_add_indexes.sql` - Performance optimization indexes
- `003_seed_data.sql` - Development seed data
- `004_enhanced_indexes.sql` - Advanced indexes and constraints

#### Usage
```bash
# Run all pending migrations
./dbmanager.sh migrate

# Check migration status
./dbmanager.sh status
```

### 2. Seed Data System

#### Features
- Environment-aware seeding (development only)
- Comprehensive test scenarios
- Conflict-safe insertion
- Multiple user types and states

#### Test Data Includes
- Active verified users
- Unverified users
- Inactive users
- OAuth users (Google, GitHub)
- Users with various login states
- Valid and expired tokens
- Sample OAuth provider data

#### Usage
```bash
# Apply seed data (development only)
./dbmanager.sh seed
```

### 3. Backup & Recovery System

#### Features
- **Compression**: Gzip compression for space efficiency
- **Validation**: Automatic backup validation
- **Metadata**: Detailed backup information and tracking
- **Listing**: Easy backup discovery and management
- **Cleanup**: Automatic old backup removal

#### Backup Options
```bash
# Create compressed, validated backup (default)
./dbmanager.sh backup

# Create uncompressed backup
./dbmanager.sh backup --no-compress

# Create backup without validation
./dbmanager.sh backup --no-validate

# List all available backups
./dbmanager.sh list-backups

# Restore from backup
./dbmanager.sh restore backups/backup_20240121_143022.sql.gz
```

#### Backup Metadata
Each backup includes metadata with:
- Creation timestamp
- File size and compression status
- Database version and table list
- Validation status
- Masked database URL

### 4. Health Monitoring System

#### Basic Health Check
```bash
./dbmanager.sh health
```

Provides:
- Database connectivity status
- Response time metrics
- Connection pool statistics
- Table health (row counts, sizes)
- Performance metrics (cache hit ratio, slow queries)

#### Detailed Health Report
```bash
./dbmanager.sh detailed-health
```

Provides comprehensive reporting including:
- **Basic Health**: Connection, performance, table status
- **Authentication Health**: User statistics, token status
- **Security Health**: Account verification, inactive accounts

#### Health Metrics
- **Database**: Connection status, response time, version
- **Tables**: Row counts, sizes, last update times
- **Performance**: Slow queries, cache hit ratio, deadlocks
- **Authentication**: User counts by type and status
- **Security**: Unverified accounts, inactive users

### 5. Maintenance & Cleanup

#### Automated Cleanup
```bash
# Cleanup expired data and old backups (default: 7 days)
./dbmanager.sh cleanup

# Cleanup with custom retention period
./dbmanager.sh cleanup 336h  # 14 days
```

#### Cleanup Operations
- Remove expired refresh tokens
- Remove revoked refresh tokens
- Remove expired OAuth provider tokens
- Remove old backup files

## Database Schema

### Core Tables

#### users
- Primary user information
- Support for email and OAuth authentication
- Soft delete support
- Activity tracking

#### oauth_providers
- OAuth provider token storage
- Support for Google and GitHub
- Token expiration tracking

#### refresh_tokens
- JWT refresh token management
- Revocation support
- Expiration tracking

### Enhanced Features

#### Indexes
- Performance-optimized indexes for common queries
- Partial indexes for filtered queries
- Composite indexes for complex operations

#### Constraints
- Email format validation
- Provider value validation
- Password/OAuth consistency checks

#### Functions
- Automatic token cleanup
- User login tracking
- Statistics generation

## Environment Configuration

### Required Variables
```bash
DATABASE_URL=postgresql://user:password@host:port/database
BACKUP_DIR=/path/to/backups  # Optional, defaults to "backups"
GO_ENV=development           # Controls seed data application
```

### Optional Variables
```bash
PGPASSWORD=password         # For pg_dump/psql operations
```

## Command Line Interface

### Database Manager Script
The `dbmanager.sh` script provides a user-friendly interface:

```bash
# Show help
./dbmanager.sh help

# Run migrations
./dbmanager.sh migrate

# Create backup
./dbmanager.sh backup

# Check health
./dbmanager.sh health

# List backups
./dbmanager.sh list-backups

# Cleanup old data
./dbmanager.sh cleanup
```

### Direct Go Commands
For advanced usage, you can use the Go binary directly:

```bash
# Build the manager
go build -o dbmanager ./cmd/dbmanager/main.go

# Run with specific options
./dbmanager -command=backup -compress=false -validate=true
```

## Monitoring & Alerting

### Health Check Integration
The health check system can be integrated with monitoring tools:

```bash
# JSON output for monitoring systems
./dbmanager -command=detailed-health | jq '.overall_status'
```

### Performance Monitoring
Key metrics to monitor:
- Database response time
- Cache hit ratio
- Active connections
- Slow query count
- Index usage ratio

### Security Monitoring
Security-related metrics:
- Unverified account count
- Inactive account count
- Failed login attempts (when implemented)
- Token expiration rates

## Best Practices

### Migration Management
1. Always test migrations in development first
2. Backup database before running migrations in production
3. Review migration status regularly
4. Keep migrations small and focused

### Backup Strategy
1. Schedule regular automated backups
2. Test backup restoration periodically
3. Store backups in multiple locations
4. Monitor backup sizes and success rates

### Health Monitoring
1. Set up automated health checks
2. Monitor key performance metrics
3. Set alerts for degraded performance
4. Regular cleanup of expired data

### Security
1. Regularly review unverified accounts
2. Monitor for inactive accounts
3. Implement failed login attempt tracking
4. Regular security health assessments

## Troubleshooting

### Common Issues

#### Migration Failures
- Check database connectivity
- Verify migration file syntax
- Review database logs
- Check for conflicting schema changes

#### Backup Failures
- Verify pg_dump is installed and accessible
- Check database permissions
- Ensure sufficient disk space
- Verify DATABASE_URL format

#### Health Check Issues
- Check database connectivity
- Verify required extensions (pg_stat_statements)
- Review database permissions
- Check for long-running queries

### Recovery Procedures

#### Failed Migration
1. Check migration status
2. Review error logs
3. Manually fix schema if needed
4. Re-run migrations

#### Corrupted Database
1. Stop application
2. Restore from latest backup
3. Re-run any missed migrations
4. Verify data integrity

## Development

### Adding New Migrations
1. Create new SQL file with incremental number
2. Follow naming convention: `XXX_description.sql`
3. Test in development environment
4. Update documentation

### Extending Health Checks
1. Add new metrics to health structs
2. Implement collection logic
3. Update detailed health report
4. Add monitoring integration

### Custom Backup Options
1. Extend BackupOptions struct
2. Add command line flags
3. Update shell script
4. Document new options

## Integration

### CI/CD Pipeline
```yaml
# Example GitHub Actions step
- name: Run Database Migrations
  run: |
    cd backend
    ./dbmanager.sh migrate
    ./dbmanager.sh health
```

### Docker Integration
```dockerfile
# Add to Dockerfile
COPY backend/dbmanager.sh /usr/local/bin/
COPY backend/migrations /app/migrations
RUN chmod +x /usr/local/bin/dbmanager.sh
```

### Monitoring Integration
```bash
# Prometheus metrics endpoint (example)
curl -s http://localhost:8080/health | jq '.database.response_time_ms'
```

This comprehensive database management system provides robust tools for maintaining the OAuth2 authentication database with automated migrations, reliable backups, detailed health monitoring, and efficient maintenance operations.