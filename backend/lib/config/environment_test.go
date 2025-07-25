package config

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDetectEnvironment(t *testing.T) {
	// Save original environment
	originalGOENV := os.Getenv("GO_ENV")
	originalNODEENV := os.Getenv("NODE_ENV")
	originalRENDER := os.Getenv("RENDER")
	
	// Restore environment after test
	defer func() {
		os.Setenv("GO_ENV", originalGOENV)
		os.Setenv("NODE_ENV", originalNODEENV)
		os.Setenv("RENDER", originalRENDER)
	}()

	tests := []struct {
		name     string
		goEnv    string
		nodeEnv  string
		render   string
		expected Environment
	}{
		{
			name:     "GO_ENV production",
			goEnv:    "production",
			expected: Production,
		},
		{
			name:     "GO_ENV development",
			goEnv:    "development",
			expected: Development,
		},
		{
			name:     "NODE_ENV production",
			nodeEnv:  "production",
			expected: Production,
		},
		{
			name:     "Render platform detection",
			render:   "true",
			expected: Production,
		},
		{
			name:     "Default to development",
			expected: Development,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear environment
			os.Unsetenv("GO_ENV")
			os.Unsetenv("NODE_ENV")
			os.Unsetenv("RENDER")
			
			// Set test environment
			if tt.goEnv != "" {
				os.Setenv("GO_ENV", tt.goEnv)
			}
			if tt.nodeEnv != "" {
				os.Setenv("NODE_ENV", tt.nodeEnv)
			}
			if tt.render != "" {
				os.Setenv("RENDER", tt.render)
			}

			result := DetectEnvironment()
			if result != tt.expected {
				t.Errorf("DetectEnvironment() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestDetectPlatform(t *testing.T) {
	// Save original environment
	originalRENDER := os.Getenv("RENDER")
	originalHEROKU := os.Getenv("HEROKU_APP_NAME")
	
	// Restore environment after test
	defer func() {
		os.Setenv("RENDER", originalRENDER)
		os.Setenv("HEROKU_APP_NAME", originalHEROKU)
	}()

	tests := []struct {
		name     string
		render   string
		heroku   string
		expected string
	}{
		{
			name:     "Render platform",
			render:   "true",
			expected: "render",
		},
		{
			name:     "Heroku platform",
			heroku:   "my-app",
			expected: "heroku",
		},
		{
			name:     "Local platform",
			expected: "local",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear environment
			os.Unsetenv("RENDER")
			os.Unsetenv("HEROKU_APP_NAME")
			
			// Set test environment
			if tt.render != "" {
				os.Setenv("RENDER", tt.render)
			}
			if tt.heroku != "" {
				os.Setenv("HEROKU_APP_NAME", tt.heroku)
			}

			result := DetectPlatform()
			if result != tt.expected {
				t.Errorf("DetectPlatform() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestNewDeploymentConfig(t *testing.T) {
	// Save original environment
	originalGOENV := os.Getenv("GO_ENV")
	
	// Restore environment after test
	defer func() {
		os.Setenv("GO_ENV", originalGOENV)
	}()

	// Test production configuration
	os.Setenv("GO_ENV", "production")
	
	config := NewDeploymentConfig()
	
	if config.Environment != Production {
		t.Errorf("Expected environment to be Production, got %v", config.Environment)
	}
	
	if !config.IsProduction {
		t.Error("Expected IsProduction to be true")
	}
	
	if config.IsDevelopment {
		t.Error("Expected IsDevelopment to be false")
	}
	
	if len(config.ConfigPaths) == 0 {
		t.Error("Expected ConfigPaths to be populated")
	}
	
	if len(config.MigrationPaths) == 0 {
		t.Error("Expected MigrationPaths to be populated")
	}
}

func TestGetEnvironmentSpecificValue(t *testing.T) {
	tests := []struct {
		name        string
		environment Environment
		devValue    string
		stagingValue string
		prodValue   string
		expected    string
	}{
		{
			name:        "Development environment",
			environment: Development,
			devValue:    "dev",
			stagingValue: "staging",
			prodValue:   "prod",
			expected:    "dev",
		},
		{
			name:        "Production environment",
			environment: Production,
			devValue:    "dev",
			stagingValue: "staging",
			prodValue:   "prod",
			expected:    "prod",
		},
		{
			name:        "Staging environment",
			environment: Staging,
			devValue:    "dev",
			stagingValue: "staging",
			prodValue:   "prod",
			expected:    "staging",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &DeploymentConfig{Environment: tt.environment}
			result := config.GetEnvironmentSpecificValue(tt.devValue, tt.stagingValue, tt.prodValue)
			if result != tt.expected {
				t.Errorf("GetEnvironmentSpecificValue() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestShouldLoadEnvFile(t *testing.T) {
	tests := []struct {
		name         string
		environment  Environment
		platform     string
		expected     bool
	}{
		{
			name:        "Development local",
			environment: Development,
			platform:    "local",
			expected:    true,
		},
		{
			name:        "Production render",
			environment: Production,
			platform:    "render",
			expected:    false,
		},
		{
			name:        "Production docker",
			environment: Production,
			platform:    "docker",
			expected:    true,
		},
		{
			name:        "Production heroku",
			environment: Production,
			platform:    "heroku",
			expected:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &DeploymentConfig{
				Environment:  tt.environment,
				IsProduction: tt.environment == Production,
				Platform:     tt.platform,
			}
			result := config.ShouldLoadEnvFile()
			if result != tt.expected {
				t.Errorf("ShouldLoadEnvFile() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetDatabasePoolSettings(t *testing.T) {
	tests := []struct {
		name         string
		isProduction bool
		expectedIdle int
		expectedOpen int
	}{
		{
			name:         "Production settings",
			isProduction: true,
			expectedIdle: 20,
			expectedOpen: 200,
		},
		{
			name:         "Development settings",
			isProduction: false,
			expectedIdle: 10,
			expectedOpen: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &DeploymentConfig{IsProduction: tt.isProduction}
			idle, open := config.GetDatabasePoolSettings()
			if idle != tt.expectedIdle {
				t.Errorf("GetDatabasePoolSettings() idle = %v, want %v", idle, tt.expectedIdle)
			}
			if open != tt.expectedOpen {
				t.Errorf("GetDatabasePoolSettings() open = %v, want %v", open, tt.expectedOpen)
			}
		})
	}
}

// Tests for deployment fixes - environment loading
func TestFindConfigFile(t *testing.T) {
	// Create temporary directory for testing
	tempDir, err := ioutil.TempDir("", "config_test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	// Create test .env file
	envFile := filepath.Join(tempDir, ".env")
	if err := ioutil.WriteFile(envFile, []byte("TEST=value"), 0644); err != nil {
		t.Fatal(err)
	}

	config := &DeploymentConfig{
		ConfigPaths: []string{
			filepath.Join(tempDir, ".env"),
			"nonexistent/.env",
		},
	}

	t.Run("finds existing config file", func(t *testing.T) {
		found, err := config.FindConfigFile(".env")
		if err != nil {
			t.Errorf("FindConfigFile() error = %v", err)
		}
		if found != envFile {
			t.Errorf("FindConfigFile() = %v, want %v", found, envFile)
		}
	})

	t.Run("handles missing config file gracefully", func(t *testing.T) {
		config := &DeploymentConfig{
			ConfigPaths: []string{"nonexistent/.env"},
			Environment: Development,
			Platform:    "local",
		}
		_, err := config.FindConfigFile(".env")
		if err == nil {
			t.Error("FindConfigFile() expected error for missing file")
		}
		if !strings.Contains(err.Error(), "configuration file not found") {
			t.Errorf("FindConfigFile() error should mention file not found, got: %v", err)
		}
	})
}

func TestEnvironmentVariablePrecedence(t *testing.T) {
	// Save original environment
	originalGOENV := os.Getenv("GO_ENV")
	originalNODEENV := os.Getenv("NODE_ENV")
	
	defer func() {
		os.Setenv("GO_ENV", originalGOENV)
		os.Setenv("NODE_ENV", originalNODEENV)
	}()

	t.Run("GO_ENV takes precedence over NODE_ENV", func(t *testing.T) {
		os.Setenv("GO_ENV", "production")
		os.Setenv("NODE_ENV", "development")
		
		env := DetectEnvironment()
		if env != Production {
			t.Errorf("DetectEnvironment() = %v, want %v", env, Production)
		}
	})

	t.Run("NODE_ENV used when GO_ENV not set", func(t *testing.T) {
		os.Unsetenv("GO_ENV")
		os.Setenv("NODE_ENV", "production")
		
		env := DetectEnvironment()
		if env != Production {
			t.Errorf("DetectEnvironment() = %v, want %v", env, Production)
		}
	})

	t.Run("defaults to development when neither set", func(t *testing.T) {
		os.Unsetenv("GO_ENV")
		os.Unsetenv("NODE_ENV")
		os.Unsetenv("RENDER")
		
		env := DetectEnvironment()
		if env != Development {
			t.Errorf("DetectEnvironment() = %v, want %v", env, Development)
		}
	})
}

func TestShouldLoadEnvFileLogic(t *testing.T) {
	tests := []struct {
		name         string
		environment  Environment
		platform     string
		expected     bool
		description  string
	}{
		{
			name:        "production render should not load env file",
			environment: Production,
			platform:    "render",
			expected:    false,
			description: "Render uses environment variables",
		},
		{
			name:        "production docker should load env file",
			environment: Production,
			platform:    "docker",
			expected:    true,
			description: "Docker can use .env files",
		},
		{
			name:        "development always loads env file",
			environment: Development,
			platform:    "local",
			expected:    true,
			description: "Development needs .env files",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &DeploymentConfig{
				Environment:  tt.environment,
				IsProduction: tt.environment == Production,
				Platform:     tt.platform,
			}
			result := config.ShouldLoadEnvFile()
			if result != tt.expected {
				t.Errorf("ShouldLoadEnvFile() = %v, want %v (%s)", result, tt.expected, tt.description)
			}
		})
	}
}

// Tests for migration path resolution
func TestFindMigrationDirectory(t *testing.T) {
	// Create temporary directory structure for testing
	tempDir, err := ioutil.TempDir("", "migration_test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	// Create migration directory with SQL files
	migrationDir := filepath.Join(tempDir, "migrations")
	if err := os.MkdirAll(migrationDir, 0755); err != nil {
		t.Fatal(err)
	}
	
	// Create test SQL file
	sqlFile := filepath.Join(migrationDir, "001_test.sql")
	if err := ioutil.WriteFile(sqlFile, []byte("CREATE TABLE test;"), 0644); err != nil {
		t.Fatal(err)
	}

	t.Run("finds migration directory with SQL files", func(t *testing.T) {
		config := &DeploymentConfig{
			MigrationPaths: []string{migrationDir, "nonexistent/migrations"},
		}
		
		found, err := config.FindMigrationDirectory()
		if err != nil {
			t.Errorf("FindMigrationDirectory() error = %v", err)
		}
		if found != migrationDir {
			t.Errorf("FindMigrationDirectory() = %v, want %v", found, migrationDir)
		}
	})

	t.Run("handles missing migration directory", func(t *testing.T) {
		config := &DeploymentConfig{
			MigrationPaths: []string{"nonexistent/migrations"},
			Environment:    Development,
			Platform:       "local",
		}
		
		_, err := config.FindMigrationDirectory()
		if err == nil {
			t.Error("FindMigrationDirectory() expected error for missing directory")
		}
		if !strings.Contains(err.Error(), "migration directory not found") {
			t.Errorf("FindMigrationDirectory() error should mention directory not found, got: %v", err)
		}
	})

	t.Run("handles directory without SQL files", func(t *testing.T) {
		emptyDir := filepath.Join(tempDir, "empty")
		if err := os.MkdirAll(emptyDir, 0755); err != nil {
			t.Fatal(err)
		}
		
		config := &DeploymentConfig{
			MigrationPaths: []string{emptyDir},
			Environment:    Development,
			Platform:       "local",
		}
		
		_, err := config.FindMigrationDirectory()
		if err == nil {
			t.Error("FindMigrationDirectory() expected error for directory without SQL files")
		}
	})
}

func TestGenerateMigrationPaths(t *testing.T) {
	// Save original environment
	originalMigrationsDir := os.Getenv("MIGRATIONS_DIR")
	defer func() {
		if originalMigrationsDir != "" {
			os.Setenv("MIGRATIONS_DIR", originalMigrationsDir)
		} else {
			os.Unsetenv("MIGRATIONS_DIR")
		}
	}()

	t.Run("includes environment variable override", func(t *testing.T) {
		os.Setenv("MIGRATIONS_DIR", "/custom/migrations")
		
		config := &DeploymentConfig{
			Platform:      "local",
			WorkingDir:    "/app",
			ExecutableDir: "/app/bin",
		}
		
		paths := config.generateMigrationPaths()
		if len(paths) == 0 {
			t.Error("generateMigrationPaths() should return paths")
		}
		if paths[0] != "/custom/migrations" {
			t.Errorf("generateMigrationPaths() first path = %v, want %v", paths[0], "/custom/migrations")
		}
	})

	t.Run("includes platform-specific paths for render", func(t *testing.T) {
		os.Unsetenv("MIGRATIONS_DIR")
		
		config := &DeploymentConfig{
			Platform: "render",
		}
		
		paths := config.generateMigrationPaths()
		found := false
		for _, path := range paths {
			if strings.Contains(path, "/opt/render/project/src") {
				found = true
				break
			}
		}
		if !found {
			t.Error("generateMigrationPaths() should include Render-specific paths")
		}
	})

	t.Run("includes standard relative paths", func(t *testing.T) {
		os.Unsetenv("MIGRATIONS_DIR")
		
		config := &DeploymentConfig{
			Platform: "local",
		}
		
		paths := config.generateMigrationPaths()
		expectedPaths := []string{"migrations", "backend/migrations"}
		
		for _, expected := range expectedPaths {
			found := false
			for _, path := range paths {
				if path == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("generateMigrationPaths() should include %v", expected)
			}
		}
	})
}

func TestMigrationPathErrorMessages(t *testing.T) {
	config := &DeploymentConfig{
		MigrationPaths: []string{"path1", "path2", "path3"},
		Environment:    Production,
		Platform:       "render",
		WorkingDir:     "/app",
		ExecutableDir:  "/app/bin",
	}
	
	_, err := config.FindMigrationDirectory()
	if err == nil {
		t.Error("FindMigrationDirectory() expected error for non-existent paths")
	}
	
	errorMsg := err.Error()
	
	// Check that error message includes attempted paths
	if !strings.Contains(errorMsg, "path1") {
		t.Error("Error message should include attempted paths")
	}
	
	// Check that error message includes deployment context
	if !strings.Contains(errorMsg, "Environment: production") {
		t.Error("Error message should include environment context")
	}
	
	if !strings.Contains(errorMsg, "Platform: render") {
		t.Error("Error message should include platform context")
	}
	
	// Check that error message includes troubleshooting info
	if !strings.Contains(errorMsg, "Troubleshooting") {
		t.Error("Error message should include troubleshooting section")
	}
}

func TestFindMigrationsByWalking(t *testing.T) {
	// Create temporary directory structure
	tempDir, err := ioutil.TempDir("", "walking_test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	// Create nested structure: tempDir/project/backend/
	projectDir := filepath.Join(tempDir, "project")
	backendDir := filepath.Join(projectDir, "backend")
	migrationDir := filepath.Join(projectDir, "backend", "migrations")
	
	if err := os.MkdirAll(migrationDir, 0755); err != nil {
		t.Fatal(err)
	}
	
	// Create test SQL file
	sqlFile := filepath.Join(migrationDir, "001_test.sql")
	if err := ioutil.WriteFile(sqlFile, []byte("CREATE TABLE test;"), 0644); err != nil {
		t.Fatal(err)
	}

	t.Run("finds migrations by walking up from nested directory", func(t *testing.T) {
		config := &DeploymentConfig{
			WorkingDir: backendDir,
		}
		
		found := config.findMigrationsByWalking(backendDir)
		if found != migrationDir {
			t.Errorf("findMigrationsByWalking() = %v, want %v", found, migrationDir)
		}
	})

	t.Run("returns empty string when no migrations found", func(t *testing.T) {
		emptyDir := filepath.Join(tempDir, "empty")
		if err := os.MkdirAll(emptyDir, 0755); err != nil {
			t.Fatal(err)
		}
		
		config := &DeploymentConfig{
			WorkingDir: emptyDir,
		}
		
		found := config.findMigrationsByWalking(emptyDir)
		if found != "" {
			t.Errorf("findMigrationsByWalking() = %v, want empty string", found)
		}
	})
}