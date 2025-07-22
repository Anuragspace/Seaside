// migrations.go (clean, updated version)
package db

import (
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
	// if err := mr.db.AutoMigrate(&MigrationRecord{}); err != nil {
	// 	return fmt.Errorf("failed to create migrations table: %w", err)
	// }

	files, err := mr.getMigrationFiles()
	if err != nil {
		return fmt.Errorf("failed to get migration files: %w", err)
	}

	var appliedMigrations []MigrationRecord
	if err := mr.db.Find(&appliedMigrations).Error; err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	appliedMap := make(map[string]bool)
	for _, migration := range appliedMigrations {
		appliedMap[migration.Filename] = true
	}

	for _, file := range files {
		if !appliedMap[file] {
			if err := mr.runMigration(file); err != nil {
				return fmt.Errorf("failed to run migration %s: %w", file, err)
			}
			log.Printf("Applied migration: %s", file)
		}
	}

	log.Println("All migrations completed successfully")
	return nil
}

// getMigrationFiles returns sorted list of migration files
func (mr *MigrationRunner) getMigrationFiles() ([]string, error) {
	files, err := ioutil.ReadDir(mr.migrationsDir)
	if err != nil {
		return nil, err
	}

	var migrationFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			migrationFiles = append(migrationFiles, file.Name())
		}
	}

	sort.Strings(migrationFiles)
	return migrationFiles, nil
}

// runMigration executes an entire migration file as a single statement
func (mr *MigrationRunner) runMigration(filename string) error {
	filePath := filepath.Join(mr.migrationsDir, filename)
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}

	sqlDB, err := mr.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL DB: %w", err)
	}

	tx, err := sqlDB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt := string(content)
	if _, err := tx.Exec(stmt); err != nil {
		return fmt.Errorf("failed to execute migration %s: %w", filename, err)
	}

	record := MigrationRecord{
		Filename:  filename,
		AppliedAt: time.Now(),
	}

	if err := mr.db.Create(&record).Error; err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	return tx.Commit()
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
		return nil, err
	}

	var appliedMigrations []MigrationRecord
	if err := mr.db.Find(&appliedMigrations).Error; err != nil {
		return nil, err
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

	return status, nil
}

// SeedDatabase runs seed data for development
func SeedDatabase(db *gorm.DB) error {
	if os.Getenv("GO_ENV") == "production" {
		log.Println("Skipping seed data in production environment")
		return nil
	}

	seedFile := "migrations/003_seed_data.sql"
	if _, err := os.Stat(seedFile); os.IsNotExist(err) {
		seedFile = "backend/migrations/003_seed_data.sql"
	}
	content, err := ioutil.ReadFile(seedFile)
	if err != nil {
		return fmt.Errorf("failed to read seed file: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL DB: %w", err)
	}

	stmt := string(content)
	if _, err := sqlDB.Exec(stmt); err != nil {
		log.Printf("Warning: Failed to execute seed data: %v", err)
	} else {
		log.Println("Seed data applied successfully")
	}

	return nil
}