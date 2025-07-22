package tests

import (
	"fmt"
	"testing"
	"time"

	"seaside/handlers"
	"seaside/lib/auth"
	"seaside/lib/db"
)

// Mock repository implementation
type MockUserRepository struct {
	users         map[string]*db.User
	refreshTokens map[string]*db.RefreshToken
	nextID        uint
}

func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		users:         make(map[string]*db.User),
		refreshTokens: make(map[string]*db.RefreshToken),
		nextID:        1,
	}
}

func (m *MockUserRepository) CreateUser(user *db.User) error {
	// Check if email already exists
	for _, existingUser := range m.users {
		if existingUser.Email == user.Email {
			return fmt.Errorf("email already exists")
		}
		if existingUser.Username == user.Username {
			return fmt.Errorf("username already exists")
		}
	}

	// Simulate auto-increment ID
	user.ID = m.nextID
	m.nextID++
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	m.users[user.Email] = user
	return nil
}

func (m *MockUserRepository) GetUserByEmail(email string) (*db.User, error) {
	if user, exists := m.users[email]; exists {
		return user, nil
	}
	return nil, fmt.Errorf("user not found")
}

func (m *MockUserRepository) GetUserByID(id uint) (*db.User, error) {
	for _, user := range m.users {
		if user.ID == id {
			return user, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

func (m *MockUserRepository) UpdateLastLogin(id uint) error {
	for _, user := range m.users {
		if user.ID == id {
			now := time.Now()
			user.LastLogin = &now
			return nil
		}
	}
	return fmt.Errorf("user not found")
}

func (m *MockUserRepository) CreateRefreshToken(token *db.RefreshToken) error {
	m.refreshTokens[token.TokenHash] = token
	return nil
}

func (m *MockUserRepository) GetRefreshToken(tokenHash string) (*db.RefreshToken, error) {
	if token, exists := m.refreshTokens[tokenHash]; exists {
		return token, nil
	}
	return nil, fmt.Errorf("refresh token not found")
}

func (m *MockUserRepository) RevokeRefreshToken(tokenHash string) error {
	if token, exists := m.refreshTokens[tokenHash]; exists {
		token.Revoked = true
		return nil
	}
	return fmt.Errorf("refresh token not found")
}

// Implement other interface methods as needed...
func (m *MockUserRepository) GetUserByUsername(username string) (*db.User, error) {
	for _, user := range m.users {
		if user.Username == username {
			return user, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

func (m *MockUserRepository) UpdateUser(user *db.User) error {
	if existingUser, exists := m.users[user.Email]; exists {
		*existingUser = *user
		return nil
	}
	return fmt.Errorf("user not found")
}

func (m *MockUserRepository) DeleteUser(id uint) error {
	for email, user := range m.users {
		if user.ID == id {
			delete(m.users, email)
			return nil
		}
	}
	return fmt.Errorf("user not found")
}

func (m *MockUserRepository) GetUserWithOAuthProviders(id uint) (*db.User, error) {
	return m.GetUserByID(id)
}

func (m *MockUserRepository) CreateOAuthProvider(provider *db.OAuthProvider) error {
	return nil
}

func (m *MockUserRepository) GetOAuthProvider(provider, providerID string) (*db.OAuthProvider, error) {
	return nil, fmt.Errorf("oauth provider not found")
}

func (m *MockUserRepository) UpdateOAuthProvider(provider *db.OAuthProvider) error {
	return nil
}

func (m *MockUserRepository) CleanupExpiredTokens() error {
	return nil
}

// Test functions
func TestCreateUser(t *testing.T) {
	// Setup
	mockRepo := NewMockUserRepository()
	jwtUtil := auth.NewJWTUtil("test-secret-key-for-testing")
	_ = handlers.NewAuthHandlers(mockRepo, jwtUtil)

	// Test data
	user := &db.User{
		Email:        "test@example.com",
		Username:     "testuser",
		PasswordHash: "hashedpassword",
		Active:       true,
		Provider:     "email",
	}

	// Test
	err := mockRepo.CreateUser(user)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Verify
	retrievedUser, err := mockRepo.GetUserByEmail("test@example.com")
	if err != nil {
		t.Errorf("Expected to find user, got error: %v", err)
	}

	if retrievedUser.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", retrievedUser.Username)
	}

	if retrievedUser.ID == 0 {
		t.Error("Expected user ID to be set")
	}
}

func TestDuplicateEmail(t *testing.T) {
	// Setup
	mockRepo := NewMockUserRepository()

	// Create first user
	user1 := &db.User{
		Email:    "test@example.com",
		Username: "testuser1",
		Active:   true,
	}

	err := mockRepo.CreateUser(user1)
	if err != nil {
		t.Errorf("Expected no error creating first user, got %v", err)
	}

	// Try to create second user with same email
	user2 := &db.User{
		Email:    "test@example.com",
		Username: "testuser2",
		Active:   true,
	}

	err = mockRepo.CreateUser(user2)
	if err == nil {
		t.Error("Expected error for duplicate email, got none")
	}

	if err.Error() != "email already exists" {
		t.Errorf("Expected 'email already exists' error, got '%s'", err.Error())
	}
}

func TestJWTTokenGeneration(t *testing.T) {
	// Setup
	jwtUtil := auth.NewJWTUtil("test-secret-key-for-testing")

	// Test token generation
	accessToken, refreshToken, err := jwtUtil.GenerateTokens(1, "test@example.com")
	if err != nil {
		t.Errorf("Expected no error generating tokens, got %v", err)
	}

	if accessToken == "" {
		t.Error("Expected access token to be generated")
	}

	if refreshToken == "" {
		t.Error("Expected refresh token to be generated")
	}

	// Test access token validation
	claims, err := jwtUtil.ValidateAccessToken(accessToken)
	if err != nil {
		t.Errorf("Expected no error validating access token, got %v", err)
	}

	if claims.UserID != 1 {
		t.Errorf("Expected user ID 1, got %d", claims.UserID)
	}

	if claims.Email != "test@example.com" {
		t.Errorf("Expected email 'test@example.com', got '%s'", claims.Email)
	}

	if claims.Type != "access" {
		t.Errorf("Expected token type 'access', got '%s'", claims.Type)
	}
}

func TestJWTTokenValidation(t *testing.T) {
	// Setup
	jwtUtil := auth.NewJWTUtil("test-secret-key-for-testing")

	// Test invalid token
	_, err := jwtUtil.ValidateAccessToken("invalid-token")
	if err == nil {
		t.Error("Expected error for invalid token, got none")
	}

	// Test wrong token type
	_, refreshToken, err := jwtUtil.GenerateTokens(1, "test@example.com")
	if err != nil {
		t.Errorf("Expected no error generating tokens, got %v", err)
	}

	// Try to validate refresh token as access token
	_, err = jwtUtil.ValidateAccessToken(refreshToken)
	if err == nil {
		t.Error("Expected error for wrong token type, got none")
	}
}

func TestPasswordHashing(t *testing.T) {
	// Setup
	passwordUtil := auth.NewPasswordUtil()

	// Test password hashing
	password := "testpassword123"
	hashedPassword, err := passwordUtil.HashPassword(password)
	if err != nil {
		t.Errorf("Expected no error hashing password, got %v", err)
	}

	if hashedPassword == "" {
		t.Error("Expected hashed password to be generated")
	}

	if hashedPassword == password {
		t.Error("Expected hashed password to be different from original")
	}

	// Test password comparison
	err = passwordUtil.ComparePassword(hashedPassword, password)
	if err != nil {
		t.Errorf("Expected no error comparing passwords, got %v", err)
	}

	// Test wrong password
	err = passwordUtil.ComparePassword(hashedPassword, "wrongpassword")
	if err == nil {
		t.Error("Expected error for wrong password, got none")
	}
}

func TestPasswordValidation(t *testing.T) {
	// Setup
	passwordUtil := auth.NewPasswordUtil()

	// Test valid password
	validPassword := "TestPass123!"
	err := passwordUtil.ValidatePasswordStrength(validPassword)
	if err != nil {
		t.Errorf("Expected no error for valid password, got %v", err)
	}

	// Test short password
	shortPassword := "Test1!"
	err = passwordUtil.ValidatePasswordStrength(shortPassword)
	if err == nil {
		t.Error("Expected error for short password, got none")
	}

	// Test password without uppercase
	noUpperPassword := "testpass123!"
	err = passwordUtil.ValidatePasswordStrength(noUpperPassword)
	if err == nil {
		t.Error("Expected error for password without uppercase, got none")
	}

	// Test password without special character
	noSpecialPassword := "TestPass123"
	err = passwordUtil.ValidatePasswordStrength(noSpecialPassword)
	if err == nil {
		t.Error("Expected error for password without special character, got none")
	}
}
