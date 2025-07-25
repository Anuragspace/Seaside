package db

import (
	"strings"
	"testing"
)

func TestEmbeddedMigrations(t *testing.T) {
	runner := NewMigrationRunner(nil, "")
	
	t.Run("can read embedded migration files", func(t *testing.T) {
		files, err := runner.getEmbeddedMigrationFiles()
		if err != nil {
			t.Errorf("getEmbeddedMigrationFiles() error = %v", err)
		}
		
		if len(files) == 0 {
			t.Error("getEmbeddedMigrationFiles() returned no files")
		}
		
		// Check that files are sorted
		for i := 1; i < len(files); i++ {
			if files[i-1] > files[i] {
				t.Errorf("Migration files are not sorted: %s > %s", files[i-1], files[i])
			}
		}
		
		// Check that all files have .sql extension
		for _, file := range files {
			if !strings.HasSuffix(file, ".sql") {
				t.Errorf("Migration file %s does not have .sql extension", file)
			}
		}
	})
	
	t.Run("getMigrationFiles prefers embedded over filesystem", func(t *testing.T) {
		files, err := runner.getMigrationFiles()
		if err != nil {
			t.Errorf("getMigrationFiles() error = %v", err)
		}
		
		if len(files) == 0 {
			t.Error("getMigrationFiles() returned no files")
		}
		
		// Should be using embedded migrations
		if runner.migrationsDir != "embedded" {
			t.Errorf("Expected migrationsDir to be 'embedded', got %s", runner.migrationsDir)
		}
	})
}