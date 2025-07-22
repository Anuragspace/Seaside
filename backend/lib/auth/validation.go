package auth

import (
	"fmt"
	"html"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
)

// ValidationUtil provides input validation and sanitization utilities
type ValidationUtil struct {
	validator *validator.Validate
}

// NewValidationUtil creates a new validation utility instance
func NewValidationUtil() *ValidationUtil {
	v := validator.New()
	
	// Register custom validators
	v.RegisterValidation("strong_password", validateStrongPassword)
	v.RegisterValidation("safe_username", validateSafeUsername)
	v.RegisterValidation("no_sql_injection", validateNoSQLInjection)
	
	return &ValidationUtil{
		validator: v,
	}
}

// ValidateStruct validates a struct using validation tags
func (v *ValidationUtil) ValidateStruct(s interface{}) error {
	return v.validator.Struct(s)
}

// SanitizeInput sanitizes user input to prevent XSS and other attacks
func (v *ValidationUtil) SanitizeInput(input string) string {
	// Remove leading/trailing whitespace
	sanitized := strings.TrimSpace(input)
	
	// HTML escape to prevent XSS
	sanitized = html.EscapeString(sanitized)
	
	// Remove null bytes
	sanitized = strings.ReplaceAll(sanitized, "\x00", "")
	
	// Remove control characters except newlines and tabs
	sanitized = regexp.MustCompile(`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`).ReplaceAllString(sanitized, "")
	
	return sanitized
}

// SanitizeEmail sanitizes and validates email format
func (v *ValidationUtil) SanitizeEmail(email string) (string, error) {
	sanitized := strings.ToLower(strings.TrimSpace(email))
	
	// Basic email regex validation
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(sanitized) {
		return "", fmt.Errorf("invalid email format")
	}
	
	// Check for common malicious patterns
	if strings.Contains(sanitized, "..") || strings.Contains(sanitized, "--") {
		return "", fmt.Errorf("invalid email format")
	}
	
	return sanitized, nil
}

// SanitizeUsername sanitizes username input
func (v *ValidationUtil) SanitizeUsername(username string) (string, error) {
	sanitized := strings.TrimSpace(username)
	
	// Username should only contain alphanumeric characters, underscores, and hyphens
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !usernameRegex.MatchString(sanitized) {
		return "", fmt.Errorf("username can only contain letters, numbers, underscores, and hyphens")
	}
	
	// Check length
	if len(sanitized) < 3 || len(sanitized) > 30 {
		return "", fmt.Errorf("username must be between 3 and 30 characters")
	}
	
	// Check for reserved usernames
	reservedUsernames := []string{"admin", "root", "system", "api", "www", "mail", "ftp", "test", "guest", "anonymous"}
	for _, reserved := range reservedUsernames {
		if strings.EqualFold(sanitized, reserved) {
			return "", fmt.Errorf("username is reserved")
		}
	}
	
	return sanitized, nil
}

// ValidateOAuth2State validates OAuth2 state parameter
func (v *ValidationUtil) ValidateOAuth2State(state string) error {
	if state == "" {
		return fmt.Errorf("state parameter is required")
	}
	
	// State should be a random string, typically base64 encoded
	if len(state) < 16 || len(state) > 128 {
		return fmt.Errorf("invalid state parameter length")
	}
	
	// Check for valid characters (base64 + URL safe characters)
	stateRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !stateRegex.MatchString(state) {
		return fmt.Errorf("invalid state parameter format")
	}
	
	return nil
}

// Custom validator functions

// validateStrongPassword validates password strength
func validateStrongPassword(fl validator.FieldLevel) bool {
	password := fl.Field().String()
	
	if len(password) < 8 || len(password) > 128 {
		return false
	}
	
	// Check for at least one uppercase letter
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	if !hasUpper {
		return false
	}
	
	// Check for at least one lowercase letter
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	if !hasLower {
		return false
	}
	
	// Check for at least one digit
	hasDigit := regexp.MustCompile(`[0-9]`).MatchString(password)
	if !hasDigit {
		return false
	}
	
	// Check for at least one special character
	hasSpecial := regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).MatchString(password)
	if !hasSpecial {
		return false
	}
	
	return true
}

// validateSafeUsername validates username for safety
func validateSafeUsername(fl validator.FieldLevel) bool {
	username := fl.Field().String()
	
	// Username should only contain alphanumeric characters, underscores, and hyphens
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	return usernameRegex.MatchString(username)
}

// validateNoSQLInjection checks for common SQL injection patterns
func validateNoSQLInjection(fl validator.FieldLevel) bool {
	input := strings.ToLower(fl.Field().String())
	
	// Common SQL injection patterns
	sqlPatterns := []string{
		"'", "\"", ";", "--", "/*", "*/", "xp_", "sp_",
		"union", "select", "insert", "update", "delete",
		"drop", "create", "alter", "exec", "execute",
		"script", "javascript", "vbscript", "onload",
		"onerror", "onclick", "<script", "</script>",
	}
	
	for _, pattern := range sqlPatterns {
		if strings.Contains(input, pattern) {
			return false
		}
	}
	
	return true
}

// GetValidationErrors formats validation errors into user-friendly messages
func (v *ValidationUtil) GetValidationErrors(err error) map[string]string {
	errors := make(map[string]string)
	
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			field := strings.ToLower(e.Field())
			
			switch e.Tag() {
			case "required":
				errors[field] = fmt.Sprintf("%s is required", e.Field())
			case "email":
				errors[field] = "Invalid email format"
			case "min":
				errors[field] = fmt.Sprintf("%s must be at least %s characters", e.Field(), e.Param())
			case "max":
				errors[field] = fmt.Sprintf("%s must be at most %s characters", e.Field(), e.Param())
			case "strong_password":
				errors[field] = "Password must contain at least 8 characters with uppercase, lowercase, number, and special character"
			case "safe_username":
				errors[field] = "Username can only contain letters, numbers, underscores, and hyphens"
			case "no_sql_injection":
				errors[field] = "Input contains invalid characters"
			default:
				errors[field] = fmt.Sprintf("%s is invalid", e.Field())
			}
		}
	}
	
	return errors
}