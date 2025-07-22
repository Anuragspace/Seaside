package auth

import (
	"fmt"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

// PasswordUtil provides password hashing and validation utilities
type PasswordUtil struct{}

// NewPasswordUtil creates a new password utility instance
func NewPasswordUtil() *PasswordUtil {
	return &PasswordUtil{}
}

// HashPassword hashes a password using bcrypt
func (p *PasswordUtil) HashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hashedBytes), nil
}

// ComparePassword compares a password with its hash
func (p *PasswordUtil) ComparePassword(hashedPassword, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}

// ValidatePasswordStrength validates password strength
func (p *PasswordUtil) ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}

	if len(password) > 128 {
		return fmt.Errorf("password must be less than 128 characters long")
	}

	// Check for at least one uppercase letter
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	if !hasUpper {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}

	// Check for at least one lowercase letter
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	if !hasLower {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}

	// Check for at least one digit
	hasDigit := regexp.MustCompile(`[0-9]`).MatchString(password)
	if !hasDigit {
		return fmt.Errorf("password must contain at least one digit")
	}

	// Check for at least one special character
	hasSpecial := regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).MatchString(password)
	if !hasSpecial {
		return fmt.Errorf("password must contain at least one special character")
	}

	return nil
}

// GenerateRandomPassword generates a random password (for testing or temporary passwords)
func (p *PasswordUtil) GenerateRandomPassword(length int) string {
	if length < 8 {
		length = 8
	}

	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	password := make([]byte, length)

	// Ensure at least one character from each required category
	password[0] = 'A' // uppercase
	password[1] = 'a' // lowercase
	password[2] = '1' // digit
	password[3] = '!' // special

	// Fill the rest randomly
	for i := 4; i < length; i++ {
		password[i] = charset[i%len(charset)]
	}

	return string(password)
}
