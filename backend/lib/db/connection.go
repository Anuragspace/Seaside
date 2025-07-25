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
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// validateDatabaseURL performs basic validation on the database URL format
func validateDatabaseURL(databaseURL string) error {
	if len(databaseURL) < 10 {
		return fmt.Errorf("DATABASE_URL is too short (minimum 10 characters)")
	}
	
	if !strings.HasPrefix(databaseURL, "postgres://") && !strings.HasPrefix(databaseURL, "postgresql://") {
		return fmt.Errorf("DATABASE_URL must start with 'postgres://' or 'postgresql://'")
	}
	
	// Check for basic components
	if !strings.Contains(databaseURL, "@") {
		return fmt.Errorf("DATABASE_URL missing '@' separator (should contain user:password@host)")
	}
	
	if !strings.Contains(databaseURL, "/") {
		return fmt.Errorf("DATABASE_URL missing database name (should end with /database_name)")
	}
	
	return nil
}

var (
	DB                *gorm.DB
	GlobalHealthChecker  *HealthChecker
	GlobalBackupManager  *BackupManager
)

func ConnectDatabase() (*gorm.DB, error) {
	log.Println("Attempting to connect to database...")
	
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Println("❌ DATABASE_URL environment variable is not set")
		return nil, fmt.Errorf("DATABASE_URL environment variable is not set.\n\nDeployment troubleshooting:\n- For Render: Set DATABASE_URL in the Environment section of your service\n- For local development: Add DATABASE_URL to your .env file\n- For Docker: Pass DATABASE_URL as environment variable\n- Format should be: postgresql://user:password@host:port/database\n- Ensure the database server is running and accessible")
	}
	
	// Validate DATABASE_URL format
	if err := validateDatabaseURL(databaseURL); err != nil {
		log.Printf("❌ Invalid DATABASE_URL format: %v", err)
		return nil, fmt.Errorf("invalid DATABASE_URL format: %w\n\nExpected format: postgresql://user:password@host:port/database\nExample: postgresql://myuser:mypass@localhost:5432/mydatabase", err)
	}
	
	// Log database connection info (without credentials)
	if len(databaseURL) > 20 {
		log.Printf("Database URL configured (length: %d chars, starts with: %s...)", 
			len(databaseURL), databaseURL[:20])
	} else {
		log.Println("Database URL configured (short format)")
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

	log.Println("Opening database connection...")
	db, err := gorm.Open(postgres.Open(databaseURL), config)
	if err != nil {
		log.Printf("❌ Failed to open database connection: %v", err)
		
		// Provide specific error guidance based on common connection issues
		errorMsg := fmt.Sprintf("failed to connect to database: %v\n\nCommon connection issues:\n", err)
		
		errorStr := err.Error()
		if strings.Contains(errorStr, "connection refused") {
			errorMsg += "- Database server is not running or not accessible\n- Check if PostgreSQL service is started\n- Verify host and port in DATABASE_URL\n- Check firewall settings"
		} else if strings.Contains(errorStr, "authentication failed") {
			errorMsg += "- Invalid username or password in DATABASE_URL\n- Database user may not exist\n- Check credentials in DATABASE_URL"
		} else if strings.Contains(errorStr, "database") && strings.Contains(errorStr, "does not exist") {
			errorMsg += "- Target database does not exist\n- Create the database first or check database name in DATABASE_URL\n- Verify database name spelling"
		} else if strings.Contains(errorStr, "timeout") {
			errorMsg += "- Connection timeout - database server may be overloaded\n- Network connectivity issues\n- Check if database server is responsive"
		} else {
			errorMsg += "- Verify DATABASE_URL format and values\n- Check database server status\n- Review database server logs for more details"
		}
		
		errorMsg += "\n\nDeployment troubleshooting:\n- For Render: Check if database service is running\n- For local development: Ensure PostgreSQL is installed and running\n- Test connection manually with psql or database client"
		
		return nil, fmt.Errorf("%s", errorMsg)
	}
	log.Println("✅ Database connection opened successfully")

	// Configure connection pool
	log.Println("Configuring database connection pool...")
	sqlDB, err := db.DB()
	if err != nil {
		log.Printf("❌ Failed to get database instance: %v", err)
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	// Set connection pool settings (will be overridden in InitializeDatabaseWithConfig if deployment config is available)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
	log.Println("✅ Connection pool configured (MaxIdle: 10, MaxOpen: 100, MaxLifetime: 1h)")

	log.Println("Testing database connectivity...")
	if err := sqlDB.Ping(); err != nil {
		log.Printf("❌ Database ping failed: %v", err)
		
		errorMsg := fmt.Sprintf("failed to ping database: %v\n\nConnection established but ping failed. This usually indicates:\n", err)
		
		errorStr := err.Error()
		if strings.Contains(errorStr, "connection") && strings.Contains(errorStr, "closed") {
			errorMsg += "- Database connection was closed unexpectedly\n- Database server may have restarted\n- Connection pool configuration issue"
		} else if strings.Contains(errorStr, "timeout") {
			errorMsg += "- Database server is not responding to ping\n- Server may be overloaded or under maintenance\n- Network connectivity issues"
		} else {
			errorMsg += "- Database server may be in an unhealthy state\n- Check database server logs\n- Verify database service status"
		}
		
		errorMsg += "\n\nTroubleshooting:\n- Check database server status and logs\n- Verify network connectivity\n- Try connecting with a database client\n- For cloud databases: Check service status dashboard"
		
		return nil, fmt.Errorf("%s", errorMsg)
	}
	log.Println("✅ Database ping successful - connection is healthy")

	return db, nil
}

func RunMigrations(db *gorm.DB) error {
	return RunMigrationsWithConfig(db, nil)
}

func RunMigrationsWithConfig(db *gorm.DB, deploymentConfig interface{}) error {
	log.Println("Initializing database migrations...")
	
	var migrationRunner *MigrationRunner
	
	// Use deployment configuration if available
	if deploymentConfig != nil {
		// Type assertion to access the deployment config methods
		if config, ok := deploymentConfig.(interface {
			FindMigrationDirectory() (string, error)
		}); ok {
			if migrationDir, err := config.FindMigrationDirectory(); err == nil {
				log.Printf("Using deployment-specific migration directory: %s", migrationDir)
				migrationRunner = NewMigrationRunner(db, migrationDir)
			} else {
				log.Printf("Deployment config migration directory lookup failed: %v", err)
				log.Println("Falling back to default migration path strategies")
				migrationRunner = NewMigrationRunner(db, "")
			}
		} else {
			log.Println("Deployment config does not support migration directory lookup, using default strategies")
			migrationRunner = NewMigrationRunner(db, "")
		}
	} else {
		// Create migration runner with empty path - it will try multiple strategies
		migrationRunner = NewMigrationRunner(db, "")
	}
	
	if err := migrationRunner.RunMigrations(); err != nil {
		return fmt.Errorf("database migration failed: %w\n\nDeployment troubleshooting:\n- For Render deployments: ensure migration files are included in the build\n- For Docker deployments: verify COPY commands include migration files\n- For local development: ensure you're running from the project root\n- Check the MIGRATIONS_DIR environment variable if using custom paths", err)
	}

	// Run GORM auto-migrations for any additional changes
	// if err := db.AutoMigrate(&User{}, &OAuthProvider{}, &RefreshToken{}); err != nil {
	// 	return fmt.Errorf("failed to auto migrate: %w", err)
	// }

	log.Println("Database migrations completed successfully")
	return nil
}

func InitializeDatabase() error {
	return InitializeDatabaseWithConfig(nil)
}

func InitializeDatabaseWithConfig(deploymentConfig interface{}) error {
	log.Println("=== Database Initialization Process ===")
	
	// Step 1: Connect to database
	db, err := ConnectDatabase()
	if err != nil {
		log.Printf("❌ Database connection failed: %v", err)
		return err
	}
	DB = db
	log.Println("✅ Database connection established and stored globally")

	// Configure deployment-specific connection pool settings
	if deploymentConfig != nil {
		if config, ok := deploymentConfig.(interface {
			GetDatabasePoolSettings() (maxIdle, maxOpen int)
		}); ok {
			maxIdle, maxOpen := config.GetDatabasePoolSettings()
			sqlDB, err := db.DB()
			if err == nil {
				sqlDB.SetMaxIdleConns(maxIdle)
				sqlDB.SetMaxOpenConns(maxOpen)
				log.Printf("✅ Deployment-specific connection pool configured (MaxIdle: %d, MaxOpen: %d)", maxIdle, maxOpen)
			}
		}
	}

	// Step 2: Run migrations with deployment configuration
	log.Println("Starting database migration process...")
	if err := RunMigrationsWithConfig(db, deploymentConfig); err != nil {
		log.Printf("❌ Database migration failed: %v", err)
		return err
	}
	log.Println("✅ Database migrations completed successfully")

	// Step 3: Initialize health checker
	log.Println("Initializing database health monitoring...")
	GlobalHealthChecker = NewHealthChecker(db)
	log.Println("✅ Health checker initialized")
	
	// Step 4: Initialize backup manager
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "backups"
	}
	log.Printf("Initializing backup manager (backup directory: %s)...", backupDir)
	GlobalBackupManager = NewBackupManager(db, backupDir)
	log.Println("✅ Backup manager initialized")

	// Step 5: Start background services
	log.Println("Starting background database services...")
	// Start health monitoring (every 5 minutes)
	GlobalHealthChecker.StartHealthMonitoring(5 * time.Minute)
	log.Println("✅ Health monitoring started (interval: 5 minutes)")
	
	// Start periodic cleanup (every hour)
	GlobalHealthChecker.StartPeriodicCleanup(time.Hour)
	log.Println("✅ Periodic cleanup started (interval: 1 hour)")

	// Step 6: Run seed data based on deployment configuration
	shouldRunSeedData := true
	if deploymentConfig != nil {
		if config, ok := deploymentConfig.(interface {
			GetIsProduction() bool
		}); ok {
			shouldRunSeedData = !config.GetIsProduction()
			if config.GetIsProduction() {
				log.Println("Skipping seed data in production environment")
			}
		}
	} else {
		// Fallback to environment variable check
		environment := os.Getenv("GO_ENV")
		log.Printf("Environment detected: %s", getEnvOrDefault("GO_ENV", "development"))
		shouldRunSeedData = environment != "production"
		if environment == "production" {
			log.Println("Skipping seed data in production environment")
		}
	}
	
	if shouldRunSeedData {
		log.Println("Running development seed data...")
		if err := SeedDatabase(db); err != nil {
			log.Printf("⚠️  Warning: Failed to seed database: %v", err)
		} else {
			log.Println("✅ Development seed data applied")
		}
	}

	log.Println("✅ Database initialization completed successfully")
	log.Println("=== End Database Initialization ===")
	return nil
}
