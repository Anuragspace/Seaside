package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// Environment represents the deployment environment
type Environment string

const (
	Development Environment = "development"
	Production  Environment = "production"
	Staging     Environment = "staging"
	Testing     Environment = "testing"
)

// DeploymentConfig holds deployment-specific configuration
type DeploymentConfig struct {
	Environment     Environment
	IsProduction    bool
	IsDevelopment   bool
	IsStaging       bool
	IsTesting       bool
	Platform        string
	WorkingDir      string
	ExecutableDir   string
	ConfigPaths     []string
	MigrationPaths  []string
}

// DetectEnvironment determines the current deployment environment
func DetectEnvironment() Environment {
	// Check GO_ENV first (explicit setting)
	if env := os.Getenv("GO_ENV"); env != "" {
		switch strings.ToLower(env) {
		case "production", "prod":
			return Production
		case "staging", "stage":
			return Staging
		case "testing", "test":
			return Testing
		case "development", "dev":
			return Development
		default:
			log.Printf("Warning: Unknown GO_ENV value '%s', defaulting to development", env)
			return Development
		}
	}

	// Check NODE_ENV (common in many deployments)
	if env := os.Getenv("NODE_ENV"); env != "" {
		switch strings.ToLower(env) {
		case "production", "prod":
			return Production
		case "staging", "stage":
			return Staging
		case "testing", "test":
			return Testing
		default:
			return Development
		}
	}

	// Check for platform-specific indicators
	if os.Getenv("RENDER") != "" || os.Getenv("RENDER_SERVICE_ID") != "" {
		log.Println("Detected Render deployment platform")
		return Production
	}

	if os.Getenv("HEROKU_APP_NAME") != "" || os.Getenv("DYNO") != "" {
		log.Println("Detected Heroku deployment platform")
		return Production
	}

	if os.Getenv("VERCEL") != "" || os.Getenv("VERCEL_ENV") != "" {
		log.Println("Detected Vercel deployment platform")
		return Production
	}

	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		log.Println("Detected AWS Lambda deployment")
		return Production
	}

	if os.Getenv("DOCKER_CONTAINER") != "" || fileExists("/.dockerenv") {
		log.Println("Detected Docker container deployment")
		// Docker could be dev or prod, check other indicators
		if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
			return Production
		}
		return Development
	}

	// Default to development if no indicators found
	log.Println("No deployment platform detected, defaulting to development environment")
	return Development
}

// DetectPlatform identifies the deployment platform
func DetectPlatform() string {
	if os.Getenv("RENDER") != "" || os.Getenv("RENDER_SERVICE_ID") != "" {
		return "render"
	}
	if os.Getenv("HEROKU_APP_NAME") != "" || os.Getenv("DYNO") != "" {
		return "heroku"
	}
	if os.Getenv("VERCEL") != "" || os.Getenv("VERCEL_ENV") != "" {
		return "vercel"
	}
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		return "aws-lambda"
	}
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return "kubernetes"
	}
	if os.Getenv("DOCKER_CONTAINER") != "" || fileExists("/.dockerenv") {
		return "docker"
	}
	return "local"
}

// NewDeploymentConfig creates a new deployment configuration
func NewDeploymentConfig() *DeploymentConfig {
	env := DetectEnvironment()
	platform := DetectPlatform()
	
	workingDir := getCurrentWorkingDir()
	executableDir := getExecutableDir()
	
	config := &DeploymentConfig{
		Environment:   env,
		IsProduction:  env == Production,
		IsDevelopment: env == Development,
		IsStaging:     env == Staging,
		IsTesting:     env == Testing,
		Platform:      platform,
		WorkingDir:    workingDir,
		ExecutableDir: executableDir,
	}
	
	// Generate environment-specific paths
	config.ConfigPaths = config.generateConfigPaths()
	config.MigrationPaths = config.generateMigrationPaths()
	
	log.Printf("Deployment configuration initialized:")
	log.Printf("  Environment: %s", config.Environment)
	log.Printf("  Platform: %s", config.Platform)
	log.Printf("  Working Directory: %s", config.WorkingDir)
	log.Printf("  Executable Directory: %s", config.ExecutableDir)
	log.Printf("  Config Paths: %d strategies", len(config.ConfigPaths))
	log.Printf("  Migration Paths: %d strategies", len(config.MigrationPaths))
	
	return config
}

// generateConfigPaths creates environment-specific configuration file paths
func (dc *DeploymentConfig) generateConfigPaths() []string {
	var paths []string
	
	// Environment-specific .env files (highest priority)
	envFile := fmt.Sprintf(".env.%s", dc.Environment)
	paths = append(paths, envFile)
	paths = append(paths, filepath.Join("backend", envFile))
	
	// Standard .env file
	paths = append(paths, ".env")
	paths = append(paths, "backend/.env")
	
	// Platform-specific paths
	switch dc.Platform {
	case "render":
		// Render typically uses environment variables, but check common locations
		paths = append(paths, "/opt/render/project/src/.env")
		paths = append(paths, "/opt/render/project/src/backend/.env")
	case "heroku":
		// Heroku uses environment variables, but check buildpack locations
		paths = append(paths, "/app/.env")
		paths = append(paths, "/app/backend/.env")
	case "docker":
		// Docker container paths
		paths = append(paths, "/app/.env")
		paths = append(paths, "/app/backend/.env")
		paths = append(paths, "/usr/src/app/.env")
		paths = append(paths, "/usr/src/app/backend/.env")
	}
	
	// Working directory relative paths
	if dc.WorkingDir != "" {
		paths = append(paths, filepath.Join(dc.WorkingDir, ".env"))
		paths = append(paths, filepath.Join(dc.WorkingDir, "backend", ".env"))
		paths = append(paths, filepath.Join(dc.WorkingDir, envFile))
		paths = append(paths, filepath.Join(dc.WorkingDir, "backend", envFile))
	}
	
	// Executable directory relative paths
	if dc.ExecutableDir != "" {
		paths = append(paths, filepath.Join(dc.ExecutableDir, ".env"))
		paths = append(paths, filepath.Join(dc.ExecutableDir, "backend", ".env"))
		paths = append(paths, filepath.Join(dc.ExecutableDir, "..", ".env"))
		paths = append(paths, filepath.Join(dc.ExecutableDir, "..", "backend", ".env"))
	}
	
	return removeDuplicatePaths(paths)
}

// generateMigrationPaths creates environment-specific migration directory paths
func (dc *DeploymentConfig) generateMigrationPaths() []string {
	var paths []string
	
	// Environment variable override (highest priority)
	if envPath := os.Getenv("MIGRATIONS_DIR"); envPath != "" {
		paths = append(paths, envPath)
	}
	
	// Platform-specific migration paths
	switch dc.Platform {
	case "render":
		// Render deployment paths - try multiple common patterns
		paths = append(paths, "/opt/render/project/src/migrations")
		paths = append(paths, "/opt/render/project/src/backend/migrations")
		paths = append(paths, "/opt/render/project/go/src/github.com/Anuragspace/Seaside/migrations")
		paths = append(paths, "/opt/render/project/go/src/github.com/Anuragspace/Seaside/backend/migrations")
		// Try relative to current working directory on Render
		if strings.Contains(dc.WorkingDir, "/opt/render/project") {
			paths = append(paths, filepath.Join(filepath.Dir(dc.WorkingDir), "migrations"))
		}
	case "heroku":
		paths = append(paths, "/app/migrations")
		paths = append(paths, "/app/backend/migrations")
	case "docker":
		paths = append(paths, "/app/migrations")
		paths = append(paths, "/app/backend/migrations")
		paths = append(paths, "/usr/src/app/migrations")
		paths = append(paths, "/usr/src/app/backend/migrations")
	}
	
	// Standard relative paths
	paths = append(paths, "migrations")
	paths = append(paths, "backend/migrations")
	paths = append(paths, "./migrations")
	paths = append(paths, "./backend/migrations")
	
	// Working directory relative paths
	if dc.WorkingDir != "" {
		paths = append(paths, filepath.Join(dc.WorkingDir, "migrations"))
		paths = append(paths, filepath.Join(dc.WorkingDir, "backend", "migrations"))
		
		// For Render: if working dir ends with /backend, try migrations in same directory
		if strings.HasSuffix(dc.WorkingDir, "/backend") {
			paths = append(paths, filepath.Join(dc.WorkingDir, "migrations"))
		}
		
		// Try parent directory migrations (common in nested deployments)
		parentDir := filepath.Dir(dc.WorkingDir)
		paths = append(paths, filepath.Join(parentDir, "migrations"))
		paths = append(paths, filepath.Join(parentDir, "backend", "migrations"))
	}
	
	// Executable directory relative paths
	if dc.ExecutableDir != "" {
		paths = append(paths, filepath.Join(dc.ExecutableDir, "migrations"))
		paths = append(paths, filepath.Join(dc.ExecutableDir, "backend", "migrations"))
		paths = append(paths, filepath.Join(dc.ExecutableDir, "..", "migrations"))
		paths = append(paths, filepath.Join(dc.ExecutableDir, "..", "backend", "migrations"))
		
		// Try parent directories (useful for nested deployments)
		parentDir := filepath.Dir(dc.ExecutableDir)
		paths = append(paths, filepath.Join(parentDir, "migrations"))
		paths = append(paths, filepath.Join(parentDir, "backend", "migrations"))
	}
	
	return removeDuplicatePaths(paths)
}

// FindConfigFile attempts to locate a configuration file using fallback strategies
func (dc *DeploymentConfig) FindConfigFile(filename string) (string, error) {
	// Try environment-specific paths first
	for _, basePath := range dc.ConfigPaths {
		if filename != "" {
			// Try the specific filename in each base path
			fullPath := filepath.Join(filepath.Dir(basePath), filename)
			if fileExists(fullPath) {
				log.Printf("Found config file: %s", fullPath)
				return fullPath, nil
			}
		}
		
		// Try the base path itself
		if fileExists(basePath) {
			log.Printf("Found config file: %s", basePath)
			return basePath, nil
		}
	}
	
	return "", fmt.Errorf("configuration file not found. Tried %d paths for '%s'.\n\nAttempted paths:\n%s\n\nDeployment context:\n- Environment: %s\n- Platform: %s\n- Working Directory: %s\n- Executable Directory: %s\n\nTroubleshooting:\n- Ensure configuration files are included in deployment\n- Check file permissions\n- Verify correct working directory\n- For %s: Configuration files should be in deployment package", len(dc.ConfigPaths), filename, formatPathList(dc.ConfigPaths), dc.Environment, dc.Platform, dc.WorkingDir, dc.ExecutableDir, dc.Platform)
}

// FindMigrationDirectory attempts to locate the migration directory using fallback strategies
func (dc *DeploymentConfig) FindMigrationDirectory() (string, error) {
	for _, path := range dc.MigrationPaths {
		if dirExists(path) {
			// Verify it contains .sql files
			if hasSQLFiles(path) {
				log.Printf("Found migration directory with SQL files: %s", path)
				return path, nil
			}
			log.Printf("Directory exists but contains no .sql files: %s", path)
		}
	}
	
	// Additional strategy: walk up directory tree looking for migrations
	if dc.WorkingDir != "" {
		if migrationDir := dc.findMigrationsByWalking(dc.WorkingDir); migrationDir != "" {
			log.Printf("Found migration directory by walking up tree: %s", migrationDir)
			return migrationDir, nil
		}
	}
	
	return "", fmt.Errorf("migration directory not found. Tried %d paths.\n\nAttempted paths:\n%s\n\nDeployment context:\n- Environment: %s\n- Platform: %s\n- Working Directory: %s\n- Executable Directory: %s\n\nTroubleshooting:\n- Ensure migration files (.sql) are included in deployment\n- Check directory permissions\n- Verify correct working directory\n- For %s: Migration files should be in deployment package\n- Set MIGRATIONS_DIR environment variable to override paths", len(dc.MigrationPaths), formatPathList(dc.MigrationPaths), dc.Environment, dc.Platform, dc.WorkingDir, dc.ExecutableDir, dc.Platform)
}

// GetEnvironmentSpecificValue returns a value based on the current environment
func (dc *DeploymentConfig) GetEnvironmentSpecificValue(devValue, stagingValue, prodValue string) string {
	switch dc.Environment {
	case Production:
		return prodValue
	case Staging:
		return stagingValue
	case Development, Testing:
		return devValue
	default:
		return devValue
	}
}

// ShouldLoadEnvFile determines if .env file loading should be attempted
func (dc *DeploymentConfig) ShouldLoadEnvFile() bool {
	// In production cloud deployments, prefer environment variables
	if dc.IsProduction {
		switch dc.Platform {
		case "render", "heroku", "vercel", "aws-lambda", "kubernetes":
			return false // These platforms use environment variables
		}
	}
	return true // Load .env file for local development and Docker
}

// GetLogLevel returns appropriate log level for the environment
func (dc *DeploymentConfig) GetLogLevel() string {
	return dc.GetEnvironmentSpecificValue("debug", "info", "warn")
}

// GetDatabasePoolSettings returns environment-appropriate database connection pool settings
func (dc *DeploymentConfig) GetDatabasePoolSettings() (maxIdle, maxOpen int) {
	if dc.IsProduction {
		return 20, 200 // Higher limits for production
	}
	return 10, 100 // Lower limits for development
}

// GetIsProduction returns whether the current environment is production
func (dc *DeploymentConfig) GetIsProduction() bool {
	return dc.IsProduction
}

// Helper functions

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func hasSQLFiles(dir string) bool {
	files, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			return true
		}
	}
	return false
}

func getCurrentWorkingDir() string {
	if workDir, err := os.Getwd(); err == nil {
		return workDir
	}
	return "unknown"
}

func getExecutableDir() string {
	if execPath, err := os.Executable(); err == nil {
		return filepath.Dir(execPath)
	}
	return "unknown"
}

func removeDuplicatePaths(paths []string) []string {
	seen := make(map[string]bool)
	var unique []string
	
	for _, path := range paths {
		if !seen[path] {
			seen[path] = true
			unique = append(unique, path)
		}
	}
	
	return unique
}

// findMigrationsByWalking walks up the directory tree looking for migrations directory
func (dc *DeploymentConfig) findMigrationsByWalking(startDir string) string {
	currentDir := startDir
	maxLevels := 5 // Prevent infinite loops
	
	for i := 0; i < maxLevels; i++ {
		// Try migrations in current directory
		migrationPath := filepath.Join(currentDir, "migrations")
		if dirExists(migrationPath) && hasSQLFiles(migrationPath) {
			return migrationPath
		}
		
		// Try backend/migrations in current directory
		backendMigrationPath := filepath.Join(currentDir, "backend", "migrations")
		if dirExists(backendMigrationPath) && hasSQLFiles(backendMigrationPath) {
			return backendMigrationPath
		}
		
		// Move up one directory
		parentDir := filepath.Dir(currentDir)
		if parentDir == currentDir {
			// Reached root directory
			break
		}
		currentDir = parentDir
	}
	
	return ""
}

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