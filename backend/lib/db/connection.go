// Step 2: Database Connection (backend/lib/db/connection.go)
// What to implement:

// Database connection function

// Connect to PostgreSQL using GORM
// Read connection string from environment variables
// Handle connection errors
// Return *gorm.DB instance
// Auto-migration function

// Use GORM's AutoMigrate() to create tables
// Migrate all three models (User, OAuthProvider, RefreshToken)

package db

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	DB                *gorm.DB
	GlobalHealthChecker  *HealthChecker
	GlobalBackupManager  *BackupManager
)

func ConnectDatabase() (*gorm.DB, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	loggerConfig := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold: time.Second,
			LogLevel:      logger.Info,
			Colorful:      true,
		},
	)

	config := &gorm.Config{
		Logger: loggerConfig,
	}

	db, err := gorm.Open(postgres.Open(databaseURL), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

func RunMigrations(db *gorm.DB) error {
	// Run SQL migrations first
	// Try migrations directory relative to current working directory
	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		migrationsDir = "backend/migrations"
	}
	migrationRunner := NewMigrationRunner(db, migrationsDir)
	
	if err := migrationRunner.RunMigrations(); err != nil {
		return fmt.Errorf("failed to run SQL migrations: %w", err)
	}

	// Run GORM auto-migrations for any additional changes
	// if err := db.AutoMigrate(&User{}, &OAuthProvider{}, &RefreshToken{}); err != nil {
	// 	return fmt.Errorf("failed to auto migrate: %w", err)
	// }

	log.Println("All migrations completed successfully")
	return nil
}

func InitializeDatabase() error {
	db, err := ConnectDatabase()
	if err != nil {
		return err
	}
	DB = db

	// Run migrations
	if err := RunMigrations(db); err != nil {
		return err
	}

	// Initialize health checker
	GlobalHealthChecker = NewHealthChecker(db)
	
	// Initialize backup manager
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "backups"
	}
	GlobalBackupManager = NewBackupManager(db, backupDir)

	// Start health monitoring (every 5 minutes)
	GlobalHealthChecker.StartHealthMonitoring(5 * time.Minute)
	
	// Start periodic cleanup (every hour)
	GlobalHealthChecker.StartPeriodicCleanup(time.Hour)

	// Run seed data in development
	if os.Getenv("GO_ENV") != "production" {
		if err := SeedDatabase(db); err != nil {
			log.Printf("Warning: Failed to seed database: %v", err)
		}
	}

	log.Println("Database initialized successfully")
	return nil
}
