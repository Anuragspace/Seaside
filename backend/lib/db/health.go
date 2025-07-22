package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

// HealthChecker provides database health monitoring
type HealthChecker struct {
	db *gorm.DB
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(db *gorm.DB) *HealthChecker {
	return &HealthChecker{db: db}
}

// HealthStatus represents the overall health status
type HealthStatus struct {
	Status      string                 `json:"status"`
	Timestamp   time.Time              `json:"timestamp"`
	Database    DatabaseHealth         `json:"database"`
	Tables      []TableHealth          `json:"tables"`
	Performance PerformanceMetrics     `json:"performance"`
	Errors      []string               `json:"errors,omitempty"`
}

// DatabaseHealth represents database connection health
type DatabaseHealth struct {
	Connected       bool          `json:"connected"`
	ResponseTime    time.Duration `json:"response_time_ms"`
	OpenConnections int           `json:"open_connections"`
	MaxConnections  int           `json:"max_connections"`
	Version         string        `json:"version"`
}

// TableHealth represents individual table health
type TableHealth struct {
	Name       string `json:"name"`
	RowCount   int64  `json:"row_count"`
	Size       string `json:"size"`
	LastUpdate string `json:"last_update"`
}

// PerformanceMetrics represents database performance metrics
type PerformanceMetrics struct {
	SlowQueries      int64         `json:"slow_queries"`
	AverageQueryTime time.Duration `json:"avg_query_time_ms"`
	CacheHitRatio    float64       `json:"cache_hit_ratio"`
	Deadlocks        int64         `json:"deadlocks"`
	ActiveConnections int          `json:"active_connections"`
	IdleConnections   int          `json:"idle_connections"`
	LongRunningQueries int         `json:"long_running_queries"`
	IndexUsage       float64       `json:"index_usage_ratio"`
}

// CheckHealth performs comprehensive health check
func (hc *HealthChecker) CheckHealth() *HealthStatus {
	start := time.Now()
	status := &HealthStatus{
		Timestamp: start,
		Status:    "healthy",
		Errors:    []string{},
	}

	// Check database connection
	dbHealth, err := hc.checkDatabaseHealth()
	if err != nil {
		status.Errors = append(status.Errors, fmt.Sprintf("Database health check failed: %v", err))
		status.Status = "unhealthy"
	}
	status.Database = dbHealth

	// Check table health
	tableHealth, err := hc.checkTableHealth()
	if err != nil {
		status.Errors = append(status.Errors, fmt.Sprintf("Table health check failed: %v", err))
		status.Status = "degraded"
	}
	status.Tables = tableHealth

	// Check performance metrics
	perfMetrics, err := hc.checkPerformanceMetrics()
	if err != nil {
		status.Errors = append(status.Errors, fmt.Sprintf("Performance metrics check failed: %v", err))
		status.Status = "degraded"
	}
	status.Performance = perfMetrics

	return status
}

// checkDatabaseHealth checks basic database connectivity and stats
func (hc *HealthChecker) checkDatabaseHealth() (DatabaseHealth, error) {
	start := time.Now()
	health := DatabaseHealth{}

	// Get SQL DB instance
	sqlDB, err := hc.db.DB()
	if err != nil {
		return health, fmt.Errorf("failed to get SQL DB: %w", err)
	}

	// Test connection with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return health, fmt.Errorf("database ping failed: %w", err)
	}

	health.Connected = true
	health.ResponseTime = time.Since(start)

	// Get connection stats
	stats := sqlDB.Stats()
	health.OpenConnections = stats.OpenConnections
	health.MaxConnections = stats.MaxOpenConnections

	// Get database version
	var version string
	if err := hc.db.Raw("SELECT version()").Scan(&version).Error; err != nil {
		log.Printf("Warning: Failed to get database version: %v", err)
	} else {
		health.Version = version
	}

	return health, nil
}

// checkTableHealth checks the health of core tables
func (hc *HealthChecker) checkTableHealth() ([]TableHealth, error) {
	tables := []string{"users", "oauth_providers", "refresh_tokens"}
	var tableHealth []TableHealth

	for _, tableName := range tables {
		health := TableHealth{Name: tableName}

		// Get row count
		var count int64
		if err := hc.db.Table(tableName).Count(&count).Error; err != nil {
			log.Printf("Warning: Failed to get row count for table %s: %v", tableName, err)
		} else {
			health.RowCount = count
		}

		// Get table size (PostgreSQL specific)
		var size string
		query := fmt.Sprintf("SELECT pg_size_pretty(pg_total_relation_size('%s'))", tableName)
		if err := hc.db.Raw(query).Scan(&size).Error; err != nil {
			log.Printf("Warning: Failed to get table size for %s: %v", tableName, err)
		} else {
			health.Size = size
		}

		// Get last update time (for tables with updated_at)
		if tableName == "users" || tableName == "oauth_providers" {
			var lastUpdate time.Time
			query := fmt.Sprintf("SELECT MAX(updated_at) FROM %s", tableName)
			if err := hc.db.Raw(query).Scan(&lastUpdate).Error; err != nil {
				log.Printf("Warning: Failed to get last update for %s: %v", tableName, err)
			} else if !lastUpdate.IsZero() {
				health.LastUpdate = lastUpdate.Format(time.RFC3339)
			}
		}

		tableHealth = append(tableHealth, health)
	}

	return tableHealth, nil
}

// checkPerformanceMetrics checks database performance metrics
func (hc *HealthChecker) checkPerformanceMetrics() (PerformanceMetrics, error) {
	metrics := PerformanceMetrics{}

	// Get slow query count (PostgreSQL specific)
	var slowQueries sql.NullInt64
	slowQuerySQL := `
		SELECT COUNT(*) 
		FROM pg_stat_statements 
		WHERE mean_time > 1000
	`
	if err := hc.db.Raw(slowQuerySQL).Scan(&slowQueries); err != nil {
		log.Printf("Warning: Failed to get slow query count (pg_stat_statements may not be enabled): %v", err)
	} else if slowQueries.Valid {
		metrics.SlowQueries = slowQueries.Int64
	}

	// Get cache hit ratio
	var cacheHitRatio sql.NullFloat64
	cacheHitSQL := `
		SELECT 
			CASE 
				WHEN (blks_hit + blks_read) = 0 THEN 0
				ELSE (blks_hit::float / (blks_hit + blks_read)) * 100
			END as cache_hit_ratio
		FROM pg_stat_database 
		WHERE datname = current_database()
	`
	if err := hc.db.Raw(cacheHitSQL).Scan(&cacheHitRatio); err != nil {
		log.Printf("Warning: Failed to get cache hit ratio: %v", err)
	} else if cacheHitRatio.Valid {
		metrics.CacheHitRatio = cacheHitRatio.Float64
	}

	// Get deadlock count
	var deadlocks sql.NullInt64
	deadlockSQL := `
		SELECT deadlocks 
		FROM pg_stat_database 
		WHERE datname = current_database()
	`
	if err := hc.db.Raw(deadlockSQL).Scan(&deadlocks); err != nil {
		log.Printf("Warning: Failed to get deadlock count: %v", err)
	} else if deadlocks.Valid {
		metrics.Deadlocks = deadlocks.Int64
	}

	// Get connection statistics
	connectionSQL := `
		SELECT 
			COUNT(*) FILTER (WHERE state = 'active') as active,
			COUNT(*) FILTER (WHERE state = 'idle') as idle
		FROM pg_stat_activity 
		WHERE datname = current_database()
	`
	var connStats struct {
		Active sql.NullInt64
		Idle   sql.NullInt64
	}
	if err := hc.db.Raw(connectionSQL).Scan(&connStats).Error; err != nil {
		log.Printf("Warning: Failed to get connection statistics: %v", err)
	} else {
		if connStats.Active.Valid {
			metrics.ActiveConnections = int(connStats.Active.Int64)
		}
		if connStats.Idle.Valid {
			metrics.IdleConnections = int(connStats.Idle.Int64)
		}
	}

	// Get long running queries count
	var longRunningQueries sql.NullInt64
	longRunningSQL := `
		SELECT COUNT(*) 
		FROM pg_stat_activity 
		WHERE state = 'active' 
		AND query_start < NOW() - INTERVAL '5 minutes'
		AND datname = current_database()
	`
	if err := hc.db.Raw(longRunningSQL).Scan(&longRunningQueries); err != nil {
		log.Printf("Warning: Failed to get long running queries count: %v", err)
	} else if longRunningQueries.Valid {
		metrics.LongRunningQueries = int(longRunningQueries.Int64)
	}

	// Get index usage ratio
	var indexUsage sql.NullFloat64
	indexUsageSQL := `
		SELECT 
			CASE 
				WHEN SUM(idx_scan + seq_scan) = 0 THEN 0
				ELSE (SUM(idx_scan)::float / SUM(idx_scan + seq_scan)) * 100
			END as index_usage_ratio
		FROM pg_stat_user_tables
	`
	if err := hc.db.Raw(indexUsageSQL).Scan(&indexUsage); err != nil {
		log.Printf("Warning: Failed to get index usage ratio: %v", err)
	} else if indexUsage.Valid {
		metrics.IndexUsage = indexUsage.Float64
	}

	return metrics, nil
}

// StartHealthMonitoring starts periodic health monitoring
func (hc *HealthChecker) StartHealthMonitoring(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			status := hc.CheckHealth()
			if status.Status != "healthy" {
				log.Printf("Database health check: %s - Errors: %v", status.Status, status.Errors)
			} else {
				log.Printf("Database health check: %s - Response time: %v", status.Status, status.Database.ResponseTime)
			}
		}
	}()
}

// CleanupExpiredData performs routine cleanup of expired data
func (hc *HealthChecker) CleanupExpiredData() error {
	// Clean up expired refresh tokens
	result := hc.db.Where("expires_at < ? OR revoked = ?", time.Now(), true).Delete(&RefreshToken{})
	if result.Error != nil {
		return fmt.Errorf("failed to cleanup expired refresh tokens: %w", result.Error)
	}

	if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d expired refresh tokens", result.RowsAffected)
	}

	// Clean up expired OAuth provider tokens
	result = hc.db.Where("expires_at < ?", time.Now()).Delete(&OAuthProvider{})
	if result.Error != nil {
		return fmt.Errorf("failed to cleanup expired OAuth tokens: %w", result.Error)
	}

	if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d expired OAuth provider tokens", result.RowsAffected)
	}

	return nil
}

// StartPeriodicCleanup starts periodic cleanup of expired data
func (hc *HealthChecker) StartPeriodicCleanup(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			if err := hc.CleanupExpiredData(); err != nil {
				log.Printf("Periodic cleanup failed: %v", err)
			}
		}
	}()
}

// GetDetailedHealthReport provides a comprehensive health report
func (hc *HealthChecker) GetDetailedHealthReport() (*DetailedHealthReport, error) {
	report := &DetailedHealthReport{
		Timestamp: time.Now(),
	}

	// Basic health check
	status := hc.CheckHealth()
	report.BasicHealth = *status

	// Authentication system specific checks
	authHealth, err := hc.checkAuthenticationHealth()
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("Authentication health check failed: %v", err))
	}
	report.AuthenticationHealth = authHealth

	// Security checks
	securityHealth, err := hc.checkSecurityHealth()
	if err != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("Security health check failed: %v", err))
	}
	report.SecurityHealth = securityHealth

	// Determine overall status
	if len(report.Errors) == 0 {
		report.OverallStatus = "healthy"
	} else if len(report.Errors) <= 2 {
		report.OverallStatus = "degraded"
	} else {
		report.OverallStatus = "unhealthy"
	}

	return report, nil
}

// DetailedHealthReport contains comprehensive health information
type DetailedHealthReport struct {
	Timestamp            time.Time            `json:"timestamp"`
	OverallStatus        string               `json:"overall_status"`
	BasicHealth          HealthStatus         `json:"basic_health"`
	AuthenticationHealth AuthenticationHealth `json:"authentication_health"`
	SecurityHealth       SecurityHealth       `json:"security_health"`
	Errors               []string             `json:"errors,omitempty"`
}

// AuthenticationHealth represents authentication system health
type AuthenticationHealth struct {
	TotalUsers        int64     `json:"total_users"`
	ActiveUsers       int64     `json:"active_users"`
	VerifiedUsers     int64     `json:"verified_users"`
	OAuthUsers        int64     `json:"oauth_users"`
	RecentLogins      int64     `json:"recent_logins"`
	ExpiredTokens     int64     `json:"expired_tokens"`
	RevokedTokens     int64     `json:"revoked_tokens"`
	LastCleanup       time.Time `json:"last_cleanup"`
}

// SecurityHealth represents security-related health metrics
type SecurityHealth struct {
	FailedLoginAttempts int64     `json:"failed_login_attempts"`
	SuspiciousActivity  int64     `json:"suspicious_activity"`
	WeakPasswords       int64     `json:"weak_passwords"`
	UnverifiedAccounts  int64     `json:"unverified_accounts"`
	InactiveAccounts    int64     `json:"inactive_accounts"`
	LastSecurityScan    time.Time `json:"last_security_scan"`
}

// checkAuthenticationHealth checks authentication system specific health
func (hc *HealthChecker) checkAuthenticationHealth() (AuthenticationHealth, error) {
	health := AuthenticationHealth{}

	// Get user statistics
	userStatsSQL := `
		SELECT 
			COUNT(*) as total_users,
			COUNT(*) FILTER (WHERE active = true) as active_users,
			COUNT(*) FILTER (WHERE email_verified = true) as verified_users,
			COUNT(*) FILTER (WHERE provider != 'email') as oauth_users,
			COUNT(*) FILTER (WHERE last_login > CURRENT_TIMESTAMP - INTERVAL '7 days') as recent_logins
		FROM users
		WHERE deleted_at IS NULL
	`
	
	var stats struct {
		TotalUsers   sql.NullInt64
		ActiveUsers  sql.NullInt64
		VerifiedUsers sql.NullInt64
		OAuthUsers   sql.NullInt64
		RecentLogins sql.NullInt64
	}

	if err := hc.db.Raw(userStatsSQL).Scan(&stats).Error; err != nil {
		return health, err
	}

	if stats.TotalUsers.Valid {
		health.TotalUsers = stats.TotalUsers.Int64
	}
	if stats.ActiveUsers.Valid {
		health.ActiveUsers = stats.ActiveUsers.Int64
	}
	if stats.VerifiedUsers.Valid {
		health.VerifiedUsers = stats.VerifiedUsers.Int64
	}
	if stats.OAuthUsers.Valid {
		health.OAuthUsers = stats.OAuthUsers.Int64
	}
	if stats.RecentLogins.Valid {
		health.RecentLogins = stats.RecentLogins.Int64
	}

	// Get token statistics
	var expiredTokens, revokedTokens sql.NullInt64
	
	if err := hc.db.Raw("SELECT COUNT(*) FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP").Scan(&expiredTokens); err == nil && expiredTokens.Valid {
		health.ExpiredTokens = expiredTokens.Int64
	}
	
	if err := hc.db.Raw("SELECT COUNT(*) FROM refresh_tokens WHERE revoked = true").Scan(&revokedTokens); err == nil && revokedTokens.Valid {
		health.RevokedTokens = revokedTokens.Int64
	}

	health.LastCleanup = time.Now() // This would be tracked separately in a real implementation

	return health, nil
}

// checkSecurityHealth checks security-related health metrics
func (hc *HealthChecker) checkSecurityHealth() (SecurityHealth, error) {
	health := SecurityHealth{}

	// Get unverified accounts count
	var unverifiedAccounts sql.NullInt64
	if err := hc.db.Raw("SELECT COUNT(*) FROM users WHERE email_verified = false AND active = true").Scan(&unverifiedAccounts); err == nil && unverifiedAccounts.Valid {
		health.UnverifiedAccounts = unverifiedAccounts.Int64
	}

	// Get inactive accounts count (no login in 90 days)
	var inactiveAccounts sql.NullInt64
	if err := hc.db.Raw("SELECT COUNT(*) FROM users WHERE last_login < CURRENT_TIMESTAMP - INTERVAL '90 days' OR last_login IS NULL").Scan(&inactiveAccounts); err == nil && inactiveAccounts.Valid {
		health.InactiveAccounts = inactiveAccounts.Int64
	}

	// Note: In a real implementation, you would track failed login attempts,
	// suspicious activity, and weak passwords in separate tables or logs
	health.FailedLoginAttempts = 0 // Would be tracked in audit logs
	health.SuspiciousActivity = 0  // Would be tracked in security logs
	health.WeakPasswords = 0       // Would require password strength analysis

	health.LastSecurityScan = time.Now()

	return health, nil
}