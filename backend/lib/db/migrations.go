// migrations.go (clean, updated version)
package db

import (
	"embed"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var embeddedMigrations embed.FS

// MigrationRecord tracks which migrations have been run
type MigrationRecord struct {
	ID        uint      `gorm:"primaryKey"`
	Filename  string    `gorm:"uniqueIndex;not null"`
	AppliedAt time.Time `gorm:"not null"`
}

// MigrationRunner handles database migrations
type MigrationRunner struct {
	db            *gorm.DB
	migrationsDir string
}

// NewMigrationRunner creates a new migration runner
func NewMigrationRunner(db *gorm.DB, migrationsDir string) *MigrationRunner {
	return &MigrationRunner{
		db:            db,
		migrationsDir: migrationsDir,
	}
}

// RunMigrations executes all pending migrations
func (mr *MigrationRunner) RunMigrations() error {
	log.Println("Starting migration process...")
	
	// Ensure migrations table exists
	if err := mr.db.AutoMigrate(&MigrationRecord{}); err != nil {
		return fmt.Errorf("failed to create migrations tracking table. This usually indicates a database connection issue.\n\nError: %w\n\nCommon causes:\n- Database connection lost or invalid\n- Insufficient database permissions (need CREATE TABLE)\n- Database is read-only\n- Database storage full\n\nTroubleshooting:\n- Verify DATABASE_URL is correct and accessible\n- Check database user has CREATE privileges\n- Test connection with: go run backend/cmd/dbmanager/main.go -command=health", err)
	}

	files, err := mr.getMigrationFiles()
	if err != nil {
		return fmt.Errorf("migration failed: %w\n\nTroubleshooting tips:\n- Ensure migration files exist in one of the expected directories\n- Check file permissions\n- Verify the MIGRATIONS_DIR environment variable if set\n- Current working directory: %s\n- Executable location: %s", err, getCurrentWorkingDir(), getExecutableDir())
	}

	if len(files) == 0 {
		log.Printf("No migration files found in directory: %s", mr.migrationsDir)
		pathStrategies := mr.getMigrationPathStrategies()
		return fmt.Errorf("no migration files found. Expected .sql files in directory: %s\n\nAll attempted paths:\n%s\n\nTroubleshooting:\n- Verify migration files exist and have .sql extension\n- Check directory permissions\n- Ensure you're running from the correct working directory\n- Current working directory: %s\n- Executable location: %s\n- Set MIGRATIONS_DIR environment variable to override default paths", mr.migrationsDir, formatPathList(pathStrategies), getCurrentWorkingDir(), getExecutableDir())
	}

	log.Printf("Found %d migration files in: %s", len(files), mr.migrationsDir)

	var appliedMigrations []MigrationRecord
	if err := mr.db.Find(&appliedMigrations).Error; err != nil {
		return fmt.Errorf("failed to query applied migrations from database. This indicates a database connectivity or permissions issue.\n\nError: %w\n\nCommon deployment scenarios:\n- First deployment: Migration tracking table may not exist yet (this is normal)\n- Database reset: Migration history was cleared\n- Permission changes: Database user lost SELECT privileges\n- Connection issues: Database temporarily unavailable\n\nTroubleshooting:\n- Verify DATABASE_URL is correct and accessible\n- Check database user has SELECT privileges on migration_records table\n- Test connection with: go run backend/cmd/dbmanager/main.go -command=health\n- For first deployment, this error may resolve after table creation", err)
	}

	appliedMap := make(map[string]bool)
	for _, migration := range appliedMigrations {
		appliedMap[migration.Filename] = true
	}

	pendingCount := 0
	for _, file := range files {
		if !appliedMap[file] {
			pendingCount++
		}
	}

	if pendingCount == 0 {
		log.Println("All migrations are already applied. Database is up to date.")
		return nil
	}

	log.Printf("Found %d pending migrations to apply", pendingCount)

	successCount := 0
	skippedCount := 0
	
	for _, file := range files {
		if !appliedMap[file] {
			log.Printf("📄 Applying migration: %s", file)
			startTime := time.Now()
			
			if err := mr.runMigration(file); err != nil {
				log.Printf("❌ Migration failed: %s (duration: %v)", file, time.Since(startTime))
				return fmt.Errorf("migration failed while applying '%s': %w\n\nMigration file location: %s\n\nCommon deployment scenarios:\n- Schema conflicts: Table/column already exists from previous deployment\n- Data conflicts: Constraint violations with existing data\n- Permission issues: Database user lacks ALTER/CREATE privileges\n- Syntax errors: SQL not compatible with target database version\n\nTroubleshooting:\n- Check the SQL syntax in the migration file\n- Verify database permissions for schema changes (ALTER, CREATE, DROP)\n- Review the migration file for conflicts with existing data\n- Check database logs for more details\n- For production: Consider rolling back problematic migration\n- Test migration on staging environment first", file, err, filepath.Join(mr.migrationsDir, file))
			}
			
			duration := time.Since(startTime)
			log.Printf("✅ Successfully applied migration: %s (duration: %v)", file, duration)
			successCount++
		} else {
			log.Printf("⏭️  Skipping already applied migration: %s", file)
			skippedCount++
		}
	}

	log.Printf("✅ Migration execution completed - Applied: %d, Skipped: %d, Total: %d", 
		successCount, skippedCount, len(files))
	log.Println("All migrations completed successfully")
	return nil
}

// getMigrationFiles returns sorted list of migration files
// First tries embedded files, then falls back to file system paths
func (mr *MigrationRunner) getMigrationFiles() ([]string, error) {
	// Strategy 1: Try embedded migration files first (most reliable for deployments)
	log.Println("Attempting to read embedded migration files...")
	if embeddedFiles, err := mr.getEmbeddedMigrationFiles(); err == nil && len(embeddedFiles) > 0 {
		log.Printf("✅ Successfully found %d embedded migration files", len(embeddedFiles))
		log.Println("Using embedded migrations (recommended for production deployments)")
		mr.migrationsDir = "embedded" // Mark as using embedded files
		return embeddedFiles, nil
	} else if err != nil {
		log.Printf("Failed to read embedded migration files: %v", err)
	} else {
		log.Println("No embedded migration files found")
	}
	
	// Strategy 2: Fall back to file system paths
	log.Println("Falling back to file system migration files...")
	pathStrategies := mr.getMigrationPathStrategies()
	
	var lastErr error
	var attemptedPaths []string
	
	for _, path := range pathStrategies {
		attemptedPaths = append(attemptedPaths, path)
		log.Printf("Attempting to read migration files from: %s", path)
		
		files, err := ioutil.ReadDir(path)
		if err != nil {
			log.Printf("Failed to read directory %s: %v", path, err)
			lastErr = err
			continue
		}
		
		var migrationFiles []string
		for _, file := range files {
			if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
				migrationFiles = append(migrationFiles, file.Name())
			}
		}
		
		if len(migrationFiles) > 0 {
			log.Printf("Successfully found %d migration files in: %s", len(migrationFiles), path)
			// Update the migrations directory to the successful path for future operations
			mr.migrationsDir = path
			sort.Strings(migrationFiles)
			return migrationFiles, nil
		}
		
		log.Printf("No migration files found in: %s", path)
	}
	
	// If we get here, none of the strategies worked
	return nil, fmt.Errorf("failed to locate migration files after trying embedded files and %d file system paths.\n\nAttempted paths:\n%s\n\nLast error: %w\n\nCommon deployment scenarios:\n- Render/Heroku: Migration files should be embedded in binary (this is now automatic)\n- Docker: Verify COPY commands include migration directory\n- Local development: Run from project root directory\n- Custom deployment: Set MIGRATIONS_DIR environment variable\n\nCurrent context:\n- Working directory: %s\n- Executable location: %s\n- MIGRATIONS_DIR env var: %s\n\nNote: This application now includes embedded migration files for reliable deployments.", len(attemptedPaths), formatPathList(attemptedPaths), lastErr, getCurrentWorkingDir(), getExecutableDir(), getEnvOrDefault("MIGRATIONS_DIR", "not set"))
}

// getEmbeddedMigrationFiles reads migration files from embedded filesystem
func (mr *MigrationRunner) getEmbeddedMigrationFiles() ([]string, error) {
	entries, err := embeddedMigrations.ReadDir("migrations")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded migrations directory: %w", err)
	}
	
	var migrationFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			migrationFiles = append(migrationFiles, entry.Name())
		}
	}
	
	sort.Strings(migrationFiles)
	return migrationFiles, nil
}

// getMigrationPathStrategies returns a list of paths to try for finding migration files
func (mr *MigrationRunner) getMigrationPathStrategies() []string {
	var paths []string
	
	// Strategy 1: Use the originally provided path
	if mr.migrationsDir != "" {
		paths = append(paths, mr.migrationsDir)
	}
	
	// Strategy 2: Try relative paths from current working directory
	paths = append(paths, "migrations")
	paths = append(paths, "backend/migrations")
	paths = append(paths, "./migrations")
	paths = append(paths, "./backend/migrations")
	
	// Strategy 3: Try paths relative to executable location
	if execPath, err := os.Executable(); err == nil {
		execDir := filepath.Dir(execPath)
		paths = append(paths, filepath.Join(execDir, "migrations"))
		paths = append(paths, filepath.Join(execDir, "backend", "migrations"))
		paths = append(paths, filepath.Join(execDir, "..", "migrations"))
		paths = append(paths, filepath.Join(execDir, "..", "backend", "migrations"))
	}
	
	// Strategy 4: Try absolute paths based on common deployment patterns
	if workDir, err := os.Getwd(); err == nil {
		paths = append(paths, filepath.Join(workDir, "migrations"))
		paths = append(paths, filepath.Join(workDir, "backend", "migrations"))
		// Try parent directories (useful for nested deployments)
		parentDir := filepath.Dir(workDir)
		paths = append(paths, filepath.Join(parentDir, "migrations"))
		paths = append(paths, filepath.Join(parentDir, "backend", "migrations"))
	}
	
	// Strategy 5: Try environment variable override
	if envPath := os.Getenv("MIGRATIONS_DIR"); envPath != "" {
		paths = append([]string{envPath}, paths...) // Prepend to try first
	}
	
	// Remove duplicates while preserving order
	seen := make(map[string]bool)
	var uniquePaths []string
	for _, path := range paths {
		if !seen[path] {
			seen[path] = true
			uniquePaths = append(uniquePaths, path)
		}
	}
	
	return uniquePaths
}

// GetMigrationFiles is a public wrapper for getMigrationFiles for testing
func (mr *MigrationRunner) GetMigrationFiles() ([]string, error) {
	return mr.getMigrationFiles()
}

// runMigration executes an entire migration file as a single statement
func (mr *MigrationRunner) runMigration(filename string) error {
	var content []byte
	var err error
	
	// Check if we're using embedded migrations
	if mr.migrationsDir == "embedded" {
		log.Printf("Executing embedded migration file: %s", filename)
		content, err = embeddedMigrations.ReadFile(filepath.Join("migrations", filename))
		if err != nil {
			return fmt.Errorf("failed to read embedded migration file %s: %w\n\nThis indicates an issue with the embedded migration files in the binary.\n\nTroubleshooting:\n- Ensure the migration file was properly embedded during build\n- Check that the file exists in the migrations/ directory in source code\n- Verify the embed directive is correct\n- Rebuild the application to refresh embedded files", filename, err)
		}
	} else {
		// Use file system path
		filePath := filepath.Join(mr.migrationsDir, filename)
		log.Printf("Executing migration file: %s", filePath)
		
		content, err = ioutil.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w\n\nFile path attempted: %s\n\nCommon deployment scenarios:\n- File missing from build: Migration files not included in deployment package\n- Permission issues: File system permissions deny read access\n- Path resolution: File exists but at different location than expected\n- Container deployment: Files not copied to correct location in image\n\nTroubleshooting:\n- Verify file exists at expected path: %s\n- Check file permissions (should be readable)\n- For Docker: Ensure COPY command includes migration files\n- For cloud deployment: Verify build includes migration directory\n- Check if file was renamed or moved", filePath, err, filePath, filePath)
		}
	}

	if len(content) == 0 {
		source := filename
		if mr.migrationsDir != "embedded" {
			source = filepath.Join(mr.migrationsDir, filename)
		}
		return fmt.Errorf("migration file %s is empty. Migration files must contain valid SQL statements.\n\nFile source: %s\n\nCommon causes:\n- File was created but never populated with SQL\n- File corruption during deployment\n- Incomplete file transfer\n- Build process stripped file contents\n\nTroubleshooting:\n- Verify the source migration file contains SQL statements\n- Check if file was properly copied during deployment\n- Ensure build process preserves file contents", filename, source)
	}

	sqlDB, err := mr.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database connection: %w\n\nThis indicates a database connectivity issue", err)
	}

	tx, err := sqlDB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin database transaction for migration %s: %w\n\nCommon deployment scenarios:\n- Database connection lost during deployment\n- Database in read-only mode (maintenance, failover)\n- Connection pool exhausted under load\n- Database user lacks transaction privileges\n\nTroubleshooting:\n- Check database connectivity: go run backend/cmd/dbmanager/main.go -command=health\n- Verify database is not in read-only mode\n- Check database user has BEGIN/COMMIT privileges\n- Ensure database is not under maintenance\n- For cloud databases: Check if instance is available", filename, err)
	}
	defer tx.Rollback()

	stmt := string(content)
	log.Printf("Executing SQL from %s (length: %d bytes)", filename, len(content))
	
	if _, err := tx.Exec(stmt); err != nil {
		source := filename
		if mr.migrationsDir != "embedded" {
			source = filepath.Join(mr.migrationsDir, filename)
		}
		return fmt.Errorf("failed to execute SQL in migration %s: %w\n\nMigration source: %s\nSQL execution failed.\n\nCommon deployment scenarios:\n- Schema conflicts: Objects already exist from previous deployment\n- Data type mismatches: Incompatible with target database version\n- Foreign key violations: Referenced tables/data missing\n- Index conflicts: Duplicate or conflicting indexes\n- Permission denied: User lacks required database privileges\n\nTroubleshooting:\n- Check SQL syntax for target database type\n- Verify all dependencies exist (tables, columns, etc.)\n- Review constraint violations with existing data\n- Ensure database user has required privileges (CREATE, ALTER, DROP, INSERT)\n- Test migration on staging environment with production-like data\n- Check database version compatibility\n\nSQL content preview (first 200 chars):\n%s", filename, err, source, truncateString(stmt, 200))
	}

	// Record the migration as applied
	record := MigrationRecord{
		Filename:  filename,
		AppliedAt: time.Now(),
	}

	if err := mr.db.Create(&record).Error; err != nil {
		return fmt.Errorf("failed to record migration %s in tracking table: %w\n\nThe migration SQL executed successfully, but we couldn't record it as applied. This may cause the migration to run again on next startup.\n\nCommon deployment scenarios:\n- Tracking table corruption: migration_records table damaged\n- Concurrent migrations: Multiple instances running simultaneously\n- Permission changes: User lost INSERT privileges after migration\n- Transaction isolation: Tracking insert failed due to isolation level\n\nTroubleshooting:\n- Check database user has INSERT privileges on migration_records table\n- Ensure only one migration process runs at a time\n- Verify migration_records table structure is intact\n- Consider manual record insertion if migration was successful", filename, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration transaction for %s: %w\n\nThe migration changes were rolled back. This usually indicates:\n\nCommon deployment scenarios:\n- Connection timeout: Database connection lost during commit\n- Deadlock detection: Transaction conflicted with other operations\n- Storage full: Database ran out of disk space\n- Constraint violations: Deferred constraints failed at commit\n\nTroubleshooting:\n- Check database connectivity and stability\n- Verify sufficient disk space on database server\n- Ensure no other processes are modifying same tables\n- Check for long-running transactions blocking commit\n- Review database logs for detailed error information\n- Consider retrying migration after resolving underlying issue", filename, err)
	}

	return nil
}

// truncateString truncates a string to maxLength and adds "..." if truncated
func truncateString(s string, maxLength int) string {
	if len(s) <= maxLength {
		return s
	}
	return s[:maxLength] + "..."
}

// getCurrentWorkingDir returns the current working directory or "unknown" if error
func getCurrentWorkingDir() string {
	if workDir, err := os.Getwd(); err == nil {
		return workDir
	}
	return "unknown"
}

// getExecutableDir returns the directory containing the executable or "unknown" if error
func getExecutableDir() string {
	if execPath, err := os.Executable(); err == nil {
		return filepath.Dir(execPath)
	}
	return "unknown"
}



// formatPathList formats a list of paths for display in error messages
func formatPathList(paths []string) string {
	if len(paths) == 0 {
		return "  (no paths attempted)"
	}
	
	var formatted strings.Builder
	for i, path := range paths {
		formatted.WriteString(fmt.Sprintf("  %d. %s", i+1, path))
		if i < len(paths)-1 {
			formatted.WriteString("\n")
		}
	}
	return formatted.String()
}

// RollbackMigration rolls back the last migration (basic implementation)
func (mr *MigrationRunner) RollbackMigration() error {
	var lastMigration MigrationRecord
	if err := mr.db.Order("applied_at DESC").First(&lastMigration).Error; err != nil {
		return fmt.Errorf("no migrations to rollback: %w", err)
	}

	if err := mr.db.Delete(&lastMigration).Error; err != nil {
		return fmt.Errorf("failed to remove migration record: %w", err)
	}

	log.Printf("Rolled back migration: %s", lastMigration.Filename)
	return nil
}

// MigrationStatus represents the status of a migration
type MigrationStatus struct {
	Filename  string
	Applied   bool
	AppliedAt *time.Time
}

// GetMigrationStatus returns the status of all migrations
func (mr *MigrationRunner) GetMigrationStatus() ([]MigrationStatus, error) {
	files, err := mr.getMigrationFiles()
	if err != nil {
		return nil, fmt.Errorf("failed to get migration files for status check: %w\n\nTroubleshooting:\n- Verify migration directory exists and is accessible\n- Check file permissions\n- Ensure migration files have .sql extension\n- Current working directory: %s\n- Executable location: %s\n- MIGRATIONS_DIR env var: %s", err, getCurrentWorkingDir(), getExecutableDir(), getEnvOrDefault("MIGRATIONS_DIR", "not set"))
	}

	if len(files) == 0 {
		pathStrategies := mr.getMigrationPathStrategies()
		return nil, fmt.Errorf("no migration files found in directory: %s\n\nAll attempted paths:\n%s\n\nThis could indicate:\n- Migration files are missing from deployment\n- Wrong directory path configuration\n- Files don't have .sql extension\n- Build process didn't include migration files\n\nCurrent context:\n- Working directory: %s\n- Executable location: %s\n- MIGRATIONS_DIR env var: %s", mr.migrationsDir, formatPathList(pathStrategies), getCurrentWorkingDir(), getExecutableDir(), getEnvOrDefault("MIGRATIONS_DIR", "not set"))
	}

	var appliedMigrations []MigrationRecord
	if err := mr.db.Find(&appliedMigrations).Error; err != nil {
		return nil, fmt.Errorf("failed to query migration tracking table: %w\n\nCommon deployment scenarios:\n- First deployment: Migration tracking table doesn't exist yet\n- Database reset: Migration history was cleared\n- Permission changes: Database user lost SELECT privileges\n- Connection issues: Database temporarily unavailable\n\nTroubleshooting:\n- Test database connection: go run backend/cmd/dbmanager/main.go -command=health\n- For first deployment: Run migrations first to create tracking table\n- Check database user has SELECT privileges on migration_records table\n- Verify database is accessible and not under maintenance", err)
	}

	appliedMap := make(map[string]time.Time)
	for _, migration := range appliedMigrations {
		appliedMap[migration.Filename] = migration.AppliedAt
	}

	var status []MigrationStatus
	for _, file := range files {
		if appliedAt, applied := appliedMap[file]; applied {
			status = append(status, MigrationStatus{
				Filename:  file,
				Applied:   true,
				AppliedAt: &appliedAt,
			})
		} else {
			status = append(status, MigrationStatus{
				Filename: file,
				Applied:  false,
			})
		}
	}

	log.Printf("Migration status check completed. Found %d total migrations, %d applied, %d pending", 
		len(status), len(appliedMigrations), len(status)-len(appliedMigrations))

	return status, nil
}

// SeedDatabase runs seed data for development
func SeedDatabase(db *gorm.DB) error {
	if os.Getenv("GO_ENV") == "production" {
		log.Println("Skipping seed data in production environment")
		return nil
	}

	// Use the same path resolution strategy for seed files
	seedPaths := getSeedPathStrategies()
	var lastErr error
	var attemptedPaths []string
	
	for _, seedFile := range seedPaths {
		attemptedPaths = append(attemptedPaths, seedFile)
		log.Printf("Attempting to read seed file from: %s", seedFile)
		
		content, err := ioutil.ReadFile(seedFile)
		if err != nil {
			log.Printf("Failed to read seed file %s: %v", seedFile, err)
			lastErr = err
			continue
		}
		
		sqlDB, err := db.DB()
		if err != nil {
			return fmt.Errorf("failed to get SQL DB: %w", err)
		}

		stmt := string(content)
		if _, err := sqlDB.Exec(stmt); err != nil {
			log.Printf("Warning: Failed to execute seed data from %s: %v", seedFile, err)
			lastErr = err
			continue
		}
		
		log.Printf("Seed data applied successfully from: %s", seedFile)
		return nil
	}
	
	log.Printf("Warning: Could not find or execute seed data.\n\nAttempted paths:\n%s\n\nLast error: %v\n\nCommon deployment scenarios:\n- Seed file missing from deployment package\n- Different directory structure in production\n- File permissions prevent reading\n- Seed data conflicts with existing data\n\nCurrent context:\n- Working directory: %s\n- Executable location: %s\n- MIGRATIONS_DIR env var: %s\n\nNote: Seed data is optional and application will continue without it.", formatPathList(attemptedPaths), lastErr, getCurrentWorkingDir(), getExecutableDir(), getEnvOrDefault("MIGRATIONS_DIR", "not set"))
	return nil // Don't fail the application if seed data can't be loaded
}

// getSeedPathStrategies returns a list of paths to try for finding seed files
func getSeedPathStrategies() []string {
	var paths []string
	
	// Strategy 1: Try relative paths from current working directory
	paths = append(paths, "migrations/003_seed_data.sql")
	paths = append(paths, "backend/migrations/003_seed_data.sql")
	paths = append(paths, "./migrations/003_seed_data.sql")
	paths = append(paths, "./backend/migrations/003_seed_data.sql")
	
	// Strategy 2: Try paths relative to executable location
	if execPath, err := os.Executable(); err == nil {
		execDir := filepath.Dir(execPath)
		paths = append(paths, filepath.Join(execDir, "migrations", "003_seed_data.sql"))
		paths = append(paths, filepath.Join(execDir, "backend", "migrations", "003_seed_data.sql"))
		paths = append(paths, filepath.Join(execDir, "..", "migrations", "003_seed_data.sql"))
		paths = append(paths, filepath.Join(execDir, "..", "backend", "migrations", "003_seed_data.sql"))
	}
	
	// Strategy 3: Try absolute paths based on common deployment patterns
	if workDir, err := os.Getwd(); err == nil {
		paths = append(paths, filepath.Join(workDir, "migrations", "003_seed_data.sql"))
		paths = append(paths, filepath.Join(workDir, "backend", "migrations", "003_seed_data.sql"))
		// Try parent directories (useful for nested deployments)
		parentDir := filepath.Dir(workDir)
		paths = append(paths, filepath.Join(parentDir, "migrations", "003_seed_data.sql"))
		paths = append(paths, filepath.Join(parentDir, "backend", "migrations", "003_seed_data.sql"))
	}
	
	// Strategy 4: Try environment variable override
	if envPath := os.Getenv("MIGRATIONS_DIR"); envPath != "" {
		paths = append([]string{filepath.Join(envPath, "003_seed_data.sql")}, paths...) // Prepend to try first
	}
	
	return paths
}