package tests

import (
	"os"
	"testing"
	"time"

	"seaside/lib/db"
)

func TestMigrationSystem(t *testing.T) {
	// Skip if no database URL
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set, skipping migration tests")
	}

	// Connect to test database
	database, err := db.ConnectDatabase()
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Test migration runner
	migrationsDir := "../migrations"
	migrationRunner := db.NewMigrationRunner(database, migrationsDir)

	// Test getting migration files
	status, err := migrationRunner.GetMigrationStatus()
	if err != nil {
		t.Fatalf("Failed to get migration status: %v", err)
	}

	if len(status) == 0 {
		t.Error("Expected migration files to be found")
	}

	// Verify expected migration files exist
	expectedFiles := []string{
		"001_initial_schema.sql",
		"002_add_indexes.sql",
		"003_seed_data.sql",
	}

	foundFiles := make(map[string]bool)
	for _, s := range status {
		foundFiles[s.Filename] = true
	}

	for _, expected := range expectedFiles {
		if !foundFiles[expected] {
			t.Errorf("Expected migration file %s not found", expected)
		}
	}
}

func TestHealthChecker(t *testing.T) {
	// Skip if no database URL
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set, skipping health check tests")
	}

	// Connect to test database
	database, err := db.ConnectDatabase()
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Create health checker
	healthChecker := db.NewHealthChecker(database)

	// Test health check
	status := healthChecker.CheckHealth()

	// Verify basic health status structure
	if status.Status == "" {
		t.Error("Health status should not be empty")
	}

	if status.Timestamp.IsZero() {
		t.Error("Health timestamp should be set")
	}

	if !status.Database.Connected {
		t.Error("Database should be connected")
	}

	if status.Database.ResponseTime <= 0 {
		t.Error("Response time should be positive")
	}

	// Test cleanup functionality
	if err := healthChecker.CleanupExpiredData(); err != nil {
		t.Errorf("Cleanup should not fail: %v", err)
	}
}

func TestBackupManager(t *testing.T) {
	// Skip if no database URL or pg_dump not available
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set, skipping backup tests")
	}

	// Connect to test database
	database, err := db.ConnectDatabase()
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Create backup manager with test directory
	backupDir := "test_backups"
	backupManager := db.NewBackupManager(database, backupDir)

	// Clean up test directory after test
	defer os.RemoveAll(backupDir)

	// Test listing backups (should be empty initially)
	backups, err := backupManager.ListBackups()
	if err != nil {
		t.Fatalf("Failed to list backups: %v", err)
	}

	if len(backups) != 0 {
		t.Error("Expected no backups initially")
	}

	// Test cleanup (should not fail even with no backups)
	if err := backupManager.CleanupOldBackups(24 * time.Hour); err != nil {
		t.Errorf("Cleanup should not fail: %v", err)
	}
}

func TestDatabaseModels(t *testing.T) {
	// Skip if no database URL
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set, skipping model tests")
	}

	// Connect to test database
	database, err := db.ConnectDatabase()
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Test that models can be auto-migrated
	// if err := database.AutoMigrate(&db.User{}, &db.OAuthProvider{}, &db.RefreshToken{}); err != nil {
	// 	t.Fatalf("Failed to auto-migrate models: %v", err)
	// }

	// Test basic model operations
	testUser := &db.User{
		Email:        "test@example.com",
		Username:     "testuser",
		PasswordHash: "hashedpassword",
		Provider:     "email",
		Active:       true,
	}

	// Create user
	if err := database.Create(testUser).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Verify user was created
	var foundUser db.User
	if err := database.Where("email = ?", testUser.Email).First(&foundUser).Error; err != nil {
		t.Fatalf("Failed to find created user: %v", err)
	}

	if foundUser.Username != testUser.Username {
		t.Errorf("Expected username %s, got %s", testUser.Username, foundUser.Username)
	}

	// Clean up test user
	database.Delete(&foundUser)
}