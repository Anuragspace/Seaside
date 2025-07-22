package db

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"
)

// BackupManager handles database backup and recovery operations
type BackupManager struct {
	db        *gorm.DB
	backupDir string
}

// NewBackupManager creates a new backup manager
func NewBackupManager(db *gorm.DB, backupDir string) *BackupManager {
	return &BackupManager{
		db:        db,
		backupDir: backupDir,
	}
}

// CreateBackup creates a database backup with optional compression
func (bm *BackupManager) CreateBackup() (string, error) {
	return bm.CreateBackupWithOptions(BackupOptions{
		Compress: true,
		Validate: true,
	})
}

// CreateBackupWithOptions creates a database backup with specified options
func (bm *BackupManager) CreateBackupWithOptions(options BackupOptions) (string, error) {
	// Ensure backup directory exists
	if err := os.MkdirAll(bm.backupDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create backup directory: %w", err)
	}

	// Generate backup filename with timestamp
	timestamp := time.Now().Format("20060102_150405")
	var backupFile string
	if options.Compress {
		backupFile = filepath.Join(bm.backupDir, fmt.Sprintf("backup_%s.sql.gz", timestamp))
	} else {
		backupFile = filepath.Join(bm.backupDir, fmt.Sprintf("backup_%s.sql", timestamp))
	}

	// Parse DATABASE_URL to get connection parameters
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return "", fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	// Extract connection parameters from DATABASE_URL
	params, err := parseDatabaseURL(databaseURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Create pg_dump command with enhanced options
	args := []string{
		"-h", params.Host,
		"-p", params.Port,
		"-U", params.User,
		"-d", params.Database,
		"--verbose",
		"--no-password",
		"--no-owner",
		"--no-privileges",
		"--create",
		"--clean",
	}

	var cmd *exec.Cmd
	if options.Compress {
		// Use pg_dump with gzip compression
		args = append(args, "-Z", "9") // Maximum compression
		args = append(args, "-f", backupFile)
		cmd = exec.Command("pg_dump", args...)
	} else {
		args = append(args, "-f", backupFile)
		cmd = exec.Command("pg_dump", args...)
	}

	// Set password environment variable
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", params.Password))

	// Execute backup command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("pg_dump failed: %w\nOutput: %s", err, string(output))
	}

	// Validate backup if requested
	if options.Validate {
		if err := bm.validateBackup(backupFile); err != nil {
			// Remove invalid backup file
			os.Remove(backupFile)
			return "", fmt.Errorf("backup validation failed: %w", err)
		}
	}

	// Create backup metadata
	metadata := BackupMetadata{
		Filename:    filepath.Base(backupFile),
		CreatedAt:   time.Now(),
		Size:        0,
		Compressed:  options.Compress,
		Validated:   options.Validate,
		DatabaseURL: maskDatabaseURL(databaseURL),
	}

	// Get file size
	if info, err := os.Stat(backupFile); err == nil {
		metadata.Size = info.Size()
	}

	// Save metadata
	if err := bm.saveBackupMetadata(backupFile, metadata); err != nil {
		log.Printf("Warning: Failed to save backup metadata: %v", err)
	}

	log.Printf("Database backup created successfully: %s (size: %d bytes, compressed: %v)", 
		backupFile, metadata.Size, options.Compress)
	return backupFile, nil
}

// RestoreBackup restores a database from backup
func (bm *BackupManager) RestoreBackup(backupFile string) error {
	// Check if backup file exists
	if _, err := os.Stat(backupFile); os.IsNotExist(err) {
		return fmt.Errorf("backup file does not exist: %s", backupFile)
	}

	// Parse DATABASE_URL to get connection parameters
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	params, err := parseDatabaseURL(databaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Create psql command to restore backup
	cmd := exec.Command("psql",
		"-h", params.Host,
		"-p", params.Port,
		"-U", params.User,
		"-d", params.Database,
		"-f", backupFile,
		"--verbose",
	)

	// Set password environment variable
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", params.Password))

	// Execute restore command
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("psql restore failed: %w\nOutput: %s", err, string(output))
	}

	log.Printf("Database restored successfully from: %s", backupFile)
	return nil
}

// ListBackups returns a list of available backup files with metadata
func (bm *BackupManager) ListBackups() ([]BackupInfo, error) {
	files, err := os.ReadDir(bm.backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []BackupInfo{}, nil
		}
		return nil, fmt.Errorf("failed to read backup directory: %w", err)
	}

	var backups []BackupInfo
	for _, file := range files {
		if file.IsDir() || strings.HasSuffix(file.Name(), ".meta") {
			continue
		}

		// Check for SQL backup files (compressed or uncompressed)
		if strings.HasSuffix(file.Name(), ".sql") || strings.HasSuffix(file.Name(), ".sql.gz") {
			info, err := file.Info()
			if err != nil {
				continue
			}

			backupPath := filepath.Join(bm.backupDir, file.Name())
			backupInfo := BackupInfo{
				Filename:   file.Name(),
				Path:       backupPath,
				Size:       info.Size(),
				CreatedAt:  info.ModTime(),
				Compressed: strings.HasSuffix(file.Name(), ".gz"),
			}

			// Load metadata if available
			if metadata, err := bm.loadBackupMetadata(backupPath); err == nil {
				backupInfo.Metadata = metadata
				backupInfo.Validated = metadata.Validated
			}

			backups = append(backups, backupInfo)
		}
	}

	return backups, nil
}

// CleanupOldBackups removes backup files older than the specified duration
func (bm *BackupManager) CleanupOldBackups(maxAge time.Duration) error {
	backups, err := bm.ListBackups()
	if err != nil {
		return err
	}

	cutoff := time.Now().Add(-maxAge)
	var deletedCount int

	for _, backup := range backups {
		if backup.CreatedAt.Before(cutoff) {
			if err := os.Remove(backup.Path); err != nil {
				log.Printf("Warning: Failed to delete old backup %s: %v", backup.Filename, err)
			} else {
				deletedCount++
				log.Printf("Deleted old backup: %s", backup.Filename)
			}
		}
	}

	log.Printf("Cleanup completed: %d old backups deleted", deletedCount)
	return nil
}

// BackupInfo contains information about a backup file
type BackupInfo struct {
	Filename   string
	Path       string
	Size       int64
	CreatedAt  time.Time
	Compressed bool
	Validated  bool
	Metadata   *BackupMetadata
}

// BackupOptions defines options for backup creation
type BackupOptions struct {
	Compress bool
	Validate bool
}

// BackupMetadata contains detailed information about a backup
type BackupMetadata struct {
	Filename    string    `json:"filename"`
	CreatedAt   time.Time `json:"created_at"`
	Size        int64     `json:"size"`
	Compressed  bool      `json:"compressed"`
	Validated   bool      `json:"validated"`
	DatabaseURL string    `json:"database_url"`
	Version     string    `json:"version"`
	Tables      []string  `json:"tables"`
}

// DatabaseParams holds database connection parameters
type DatabaseParams struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
}

// parseDatabaseURL parses a PostgreSQL connection URL
func parseDatabaseURL(databaseURL string) (*DatabaseParams, error) {
	// Simple parsing for postgresql://user:password@host:port/database
	if !strings.HasPrefix(databaseURL, "postgresql://") {
		return nil, fmt.Errorf("invalid database URL format")
	}

	// Remove protocol
	url := strings.TrimPrefix(databaseURL, "postgresql://")

	// Split user:password@host:port/database
	parts := strings.Split(url, "@")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid database URL format")
	}

	// Parse user:password
	userPass := strings.Split(parts[0], ":")
	if len(userPass) != 2 {
		return nil, fmt.Errorf("invalid user:password format")
	}

	// Parse host:port/database
	hostPortDB := parts[1]
	
	// Remove query parameters if present
	if idx := strings.Index(hostPortDB, "?"); idx != -1 {
		hostPortDB = hostPortDB[:idx]
	}

	// Split host:port and database
	dbParts := strings.Split(hostPortDB, "/")
	if len(dbParts) != 2 {
		return nil, fmt.Errorf("invalid host:port/database format")
	}

	// Split host:port
	hostPort := strings.Split(dbParts[0], ":")
	if len(hostPort) != 2 {
		return nil, fmt.Errorf("invalid host:port format")
	}

	return &DatabaseParams{
		Host:     hostPort[0],
		Port:     hostPort[1],
		User:     userPass[0],
		Password: userPass[1],
		Database: dbParts[1],
	}, nil
}

// validateBackup validates that a backup file is readable and contains expected content
func (bm *BackupManager) validateBackup(backupFile string) error {
	// Check if file exists and is readable
	info, err := os.Stat(backupFile)
	if err != nil {
		return fmt.Errorf("backup file not accessible: %w", err)
	}

	// Check file size (should not be empty)
	if info.Size() == 0 {
		return fmt.Errorf("backup file is empty")
	}

	// For compressed files, try to read the header
	if strings.HasSuffix(backupFile, ".gz") {
		file, err := os.Open(backupFile)
		if err != nil {
			return fmt.Errorf("cannot open compressed backup: %w", err)
		}
		defer file.Close()

		// Read first few bytes to verify gzip header
		header := make([]byte, 3)
		if _, err := file.Read(header); err != nil {
			return fmt.Errorf("cannot read backup header: %w", err)
		}

		// Check gzip magic number
		if header[0] != 0x1f || header[1] != 0x8b {
			return fmt.Errorf("invalid gzip header in compressed backup")
		}
	} else {
		// For uncompressed files, check for SQL content
		file, err := os.Open(backupFile)
		if err != nil {
			return fmt.Errorf("cannot open backup file: %w", err)
		}
		defer file.Close()

		// Read first 1KB to check for SQL content
		buffer := make([]byte, 1024)
		n, err := file.Read(buffer)
		if err != nil && err.Error() != "EOF" {
			return fmt.Errorf("cannot read backup content: %w", err)
		}

		content := string(buffer[:n])
		if !strings.Contains(content, "PostgreSQL") && !strings.Contains(content, "CREATE") {
			return fmt.Errorf("backup file does not contain expected SQL content")
		}
	}

	return nil
}

// saveBackupMetadata saves backup metadata to a JSON file
func (bm *BackupManager) saveBackupMetadata(backupFile string, metadata BackupMetadata) error {
	metadataFile := backupFile + ".meta"
	
	// Get database version and table list
	if version, err := bm.getDatabaseVersion(); err == nil {
		metadata.Version = version
	}
	
	if tables, err := bm.getTableList(); err == nil {
		metadata.Tables = tables
	}

	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	if err := os.WriteFile(metadataFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write metadata file: %w", err)
	}

	return nil
}

// loadBackupMetadata loads backup metadata from JSON file
func (bm *BackupManager) loadBackupMetadata(backupFile string) (*BackupMetadata, error) {
	metadataFile := backupFile + ".meta"
	
	data, err := os.ReadFile(metadataFile)
	if err != nil {
		return nil, err // Metadata file doesn't exist
	}

	var metadata BackupMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &metadata, nil
}

// getDatabaseVersion gets the database version
func (bm *BackupManager) getDatabaseVersion() (string, error) {
	var version string
	if err := bm.db.Raw("SELECT version()").Scan(&version).Error; err != nil {
		return "", err
	}
	return version, nil
}

// getTableList gets list of tables in the database
func (bm *BackupManager) getTableList() ([]string, error) {
	var tables []string
	query := `
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' 
		ORDER BY table_name
	`
	if err := bm.db.Raw(query).Scan(&tables).Error; err != nil {
		return nil, err
	}
	return tables, nil
}

// maskDatabaseURL masks sensitive information in database URL
func maskDatabaseURL(url string) string {
	// Replace password with asterisks
	if idx := strings.Index(url, "://"); idx != -1 {
		if atIdx := strings.Index(url[idx+3:], "@"); atIdx != -1 {
			beforeAt := url[:idx+3+atIdx]
			afterAt := url[idx+3+atIdx:]
			
			if colonIdx := strings.Index(beforeAt, ":"); colonIdx != -1 {
				userPart := beforeAt[:colonIdx+1]
				return userPart + "****" + afterAt
			}
		}
	}
	return url
}