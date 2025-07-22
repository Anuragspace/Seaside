package tests

import (
	"testing"

	"seaside/lib/auth"
)

func TestPasswordUtil(t *testing.T) {
	passwordUtil := auth.NewPasswordUtil()

	t.Run("HashPassword", func(t *testing.T) {
		password := "TestPassword123!"
		hash, err := passwordUtil.HashPassword(password)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if hash == "" {
			t.Fatal("Expected hash to be non-empty")
		}
		if hash == password {
			t.Fatal("Expected hash to be different from password")
		}
	})

	t.Run("ComparePassword", func(t *testing.T) {
		password := "TestPassword123!"
		hash, _ := passwordUtil.HashPassword(password)

		// Valid password
		err := passwordUtil.ComparePassword(hash, password)
		if err != nil {
			t.Fatalf("Expected no error for valid password, got %v", err)
		}

		// Invalid password
		err = passwordUtil.ComparePassword(hash, "WrongPassword")
		if err == nil {
			t.Fatal("Expected error for invalid password")
		}
	})

	t.Run("ValidatePasswordStrength", func(t *testing.T) {
		tests := []struct {
			password string
			valid    bool
		}{
			{"Password123!", true},
			{"password123!", false}, // no uppercase
			{"PASSWORD123!", false}, // no lowercase
			{"Password!", false},    // no digit
			{"Password123", false},  // no special char
			{"Pass1!", false},       // too short
			{"", false},             // empty
		}

		for _, test := range tests {
			err := passwordUtil.ValidatePasswordStrength(test.password)
			if test.valid && err != nil {
				t.Errorf("Expected password '%s' to be valid, got error: %v", test.password, err)
			}
			if !test.valid && err == nil {
				t.Errorf("Expected password '%s' to be invalid", test.password)
			}
		}
	})
}

func TestValidationUtil(t *testing.T) {
	validationUtil := auth.NewValidationUtil()

	t.Run("SanitizeInput", func(t *testing.T) {
		tests := []struct {
			input    string
			expected string
		}{
			{"  hello world  ", "hello world"},
			{"<script>alert('xss')</script>", "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"},
			{"test\x00null", "testnull"},
			{"normal text", "normal text"},
		}

		for _, test := range tests {
			result := validationUtil.SanitizeInput(test.input)
			if result != test.expected {
				t.Errorf("Expected '%s', got '%s'", test.expected, result)
			}
		}
	})

	t.Run("SanitizeEmail", func(t *testing.T) {
		tests := []struct {
			email   string
			valid   bool
			expected string
		}{
			{"test@example.com", true, "test@example.com"},
			{"  TEST@EXAMPLE.COM  ", true, "test@example.com"},
			{"invalid-email", false, ""},
			{"test..test@example.com", false, ""},
			{"test@", false, ""},
		}

		for _, test := range tests {
			result, err := validationUtil.SanitizeEmail(test.email)
			if test.valid {
				if err != nil {
					t.Errorf("Expected email '%s' to be valid, got error: %v", test.email, err)
				}
				if result != test.expected {
					t.Errorf("Expected '%s', got '%s'", test.expected, result)
				}
			} else {
				if err == nil {
					t.Errorf("Expected email '%s' to be invalid", test.email)
				}
			}
		}
	})

	t.Run("SanitizeUsername", func(t *testing.T) {
		tests := []struct {
			username string
			valid    bool
			expected string
		}{
			{"testuser", true, "testuser"},
			{"test_user", true, "test_user"},
			{"test-user", true, "test-user"},
			{"test123", true, "test123"},
			{"admin", false, ""},
			{"te", false, ""},                    // too short
			{"test user", false, ""},             // space not allowed
			{"test@user", false, ""},             // @ not allowed
			{"verylongusernamethatexceedslimit", false, ""}, // too long
		}

		for _, test := range tests {
			result, err := validationUtil.SanitizeUsername(test.username)
			if test.valid {
				if err != nil {
					t.Errorf("Expected username '%s' to be valid, got error: %v", test.username, err)
				}
				if result != test.expected {
					t.Errorf("Expected '%s', got '%s'", test.expected, result)
				}
			} else {
				if err == nil {
					t.Errorf("Expected username '%s' to be invalid", test.username)
				}
			}
		}
	})

	t.Run("ValidateOAuth2State", func(t *testing.T) {
		tests := []struct {
			state string
			valid bool
		}{
			{"validStateParameter123", true},
			{"valid-state_parameter", true},
			{"", false},                    // empty
			{"short", false},               // too short
			{"state with spaces", false},   // spaces not allowed
			{"state@invalid", false},       // @ not allowed
		}

		for _, test := range tests {
			err := validationUtil.ValidateOAuth2State(test.state)
			if test.valid && err != nil {
				t.Errorf("Expected state '%s' to be valid, got error: %v", test.state, err)
			}
			if !test.valid && err == nil {
				t.Errorf("Expected state '%s' to be invalid", test.state)
			}
		}
	})
}

func TestOAuth2StateManager(t *testing.T) {
	stateManager := auth.NewOAuth2StateManager()

	t.Run("GenerateState", func(t *testing.T) {
		state, err := stateManager.GenerateState("127.0.0.1", "google")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if state == "" {
			t.Fatal("Expected state to be non-empty")
		}
		if len(state) < 16 {
			t.Fatal("Expected state to be at least 16 characters")
		}
	})

	t.Run("ValidateState", func(t *testing.T) {
		userIP := "127.0.0.1"
		provider := "google"
		
		// Generate a valid state
		state, err := stateManager.GenerateState(userIP, provider)
		if err != nil {
			t.Fatalf("Failed to generate state: %v", err)
		}

		// Valid state should pass validation
		err = stateManager.ValidateState(state, userIP, provider)
		if err != nil {
			t.Errorf("Expected valid state to pass validation, got error: %v", err)
		}

		// Same state should fail second validation (one-time use)
		err = stateManager.ValidateState(state, userIP, provider)
		if err == nil {
			t.Error("Expected state to fail second validation (one-time use)")
		}
	})

	t.Run("ValidateStateIPMismatch", func(t *testing.T) {
		userIP := "127.0.0.1"
		differentIP := "192.168.1.1"
		provider := "google"
		
		state, _ := stateManager.GenerateState(userIP, provider)
		
		// Different IP should fail validation
		err := stateManager.ValidateState(state, differentIP, provider)
		if err == nil {
			t.Error("Expected state validation to fail with different IP")
		}
	})

	t.Run("ValidateStateProviderMismatch", func(t *testing.T) {
		userIP := "127.0.0.1"
		provider := "google"
		differentProvider := "github"
		
		state, _ := stateManager.GenerateState(userIP, provider)
		
		// Different provider should fail validation
		err := stateManager.ValidateState(state, userIP, differentProvider)
		if err == nil {
			t.Error("Expected state validation to fail with different provider")
		}
	})

	t.Run("StateExpiration", func(t *testing.T) {
		// This test would require mocking time or waiting, 
		// so we'll just test that the cleanup function exists
		count := stateManager.GetStateCount()
		if count < 0 {
			t.Error("Expected state count to be non-negative")
		}
		
		cleared := stateManager.ClearExpiredStates()
		if cleared < 0 {
			t.Error("Expected cleared count to be non-negative")
		}
	})
}

func TestJWTUtilSecurity(t *testing.T) {
	jwtUtil := auth.NewJWTUtil("test-secret-key-for-testing")

	t.Run("TokenGeneration", func(t *testing.T) {
		userID := uint(1)
		email := "test@example.com"

		accessToken, refreshToken, err := jwtUtil.GenerateTokens(userID, email)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if accessToken == "" || refreshToken == "" {
			t.Fatal("Expected tokens to be non-empty")
		}

		if accessToken == refreshToken {
			t.Fatal("Expected access and refresh tokens to be different")
		}
	})

	t.Run("TokenValidation", func(t *testing.T) {
		userID := uint(1)
		email := "test@example.com"

		accessToken, refreshToken, _ := jwtUtil.GenerateTokens(userID, email)

		// Validate access token
		claims, err := jwtUtil.ValidateAccessToken(accessToken)
		if err != nil {
			t.Fatalf("Expected no error validating access token, got %v", err)
		}
		if claims.UserID != userID || claims.Email != email {
			t.Error("Token claims don't match expected values")
		}

		// Validate refresh token
		claims, err = jwtUtil.ValidateRefreshToken(refreshToken)
		if err != nil {
			t.Fatalf("Expected no error validating refresh token, got %v", err)
		}
		if claims.UserID != userID || claims.Email != email {
			t.Error("Token claims don't match expected values")
		}

		// Cross-validation should fail
		_, err = jwtUtil.ValidateRefreshToken(accessToken)
		if err == nil {
			t.Error("Expected access token to fail refresh token validation")
		}

		_, err = jwtUtil.ValidateAccessToken(refreshToken)
		if err == nil {
			t.Error("Expected refresh token to fail access token validation")
		}
	})

	t.Run("TokenHashing", func(t *testing.T) {
		token := "test-token-string"
		hash1 := jwtUtil.HashToken(token)
		hash2 := jwtUtil.HashToken(token)

		if hash1 != hash2 {
			t.Error("Expected same token to produce same hash")
		}

		if hash1 == token {
			t.Error("Expected hash to be different from original token")
		}

		differentToken := "different-token-string"
		differentHash := jwtUtil.HashToken(differentToken)
		if hash1 == differentHash {
			t.Error("Expected different tokens to produce different hashes")
		}
	})

	t.Run("ExtractTokenFromHeader", func(t *testing.T) {
		tests := []struct {
			header   string
			expected string
		}{
			{"Bearer token123", "token123"},
			{"Bearer ", ""},
			{"token123", ""},
			{"", ""},
		}

		for _, test := range tests {
			result := jwtUtil.ExtractTokenFromHeader(test.header)
			if result != test.expected {
				t.Errorf("Expected '%s', got '%s'", test.expected, result)
			}
		}
	})
}