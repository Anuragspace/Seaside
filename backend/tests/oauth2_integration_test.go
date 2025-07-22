package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"seaside/lib/auth"
)

func TestOAuth2Service_ExchangeGoogleCode(t *testing.T) {
	// Setup mock server for Google OAuth2
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			// Mock token exchange
			tokenResp := map[string]interface{}{
				"access_token":  "mock_access_token",
				"refresh_token": "mock_refresh_token",
				"token_type":    "Bearer",
				"expires_in":    3600,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(tokenResp)
		case "/userinfo":
			// Mock user info
			userInfo := map[string]interface{}{
				"id":             "123456789",
				"email":          "test@gmail.com",
				"name":           "Test User",
				"picture":        "https://example.com/avatar.jpg",
				"verified_email": true,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(userInfo)
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	// Set environment variables for testing
	os.Setenv("GOOGLE_CLIENT_ID", "test_client_id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "test_client_secret")
	os.Setenv("FRONTEND_URL", "http://localhost:3000")

	// Create OAuth2 service with custom HTTP client pointing to mock server
	baseURLs := map[string]string{
		"google_token":    mockServer.URL + "/token",
		"google_userinfo": mockServer.URL + "/userinfo",
	}
	service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 30 * time.Second}, baseURLs)

	// Test successful code exchange
	userInfo, tokenResp, err := service.ExchangeGoogleCode("test_code")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if userInfo == nil {
		t.Fatal("Expected user info, got nil")
	}

	if userInfo.ID != "123456789" {
		t.Errorf("Expected user ID '123456789', got '%s'", userInfo.ID)
	}

	if userInfo.Email != "test@gmail.com" {
		t.Errorf("Expected email 'test@gmail.com', got '%s'", userInfo.Email)
	}

	if tokenResp == nil {
		t.Fatal("Expected token response, got nil")
	}

	if tokenResp.AccessToken != "mock_access_token" {
		t.Errorf("Expected access token 'mock_access_token', got '%s'", tokenResp.AccessToken)
	}
}

func TestOAuth2Service_ExchangeGitHubCode(t *testing.T) {
	// Setup mock server for GitHub OAuth2
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/access_token":
			// Mock token exchange
			tokenResp := map[string]interface{}{
				"access_token": "mock_github_token",
				"token_type":   "bearer",
				"scope":        "user:email",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(tokenResp)
		case "/user":
			// Mock user info
			userInfo := map[string]interface{}{
				"id":         987654321,
				"login":      "testuser",
				"name":       "Test User",
				"email":      "test@example.com",
				"avatar_url": "https://github.com/avatar.jpg",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(userInfo)
		case "/user/emails":
			// Mock emails endpoint
			emails := []map[string]interface{}{
				{
					"email":    "test@example.com",
					"primary":  true,
					"verified": true,
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(emails)
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	// Set environment variables for testing
	os.Setenv("GITHUB_CLIENT_ID", "test_github_client_id")
	os.Setenv("GITHUB_CLIENT_SECRET", "test_github_client_secret")

	// Create OAuth2 service with mock URLs
	baseURLs := map[string]string{
		"github_token":    mockServer.URL + "/access_token",
		"github_userinfo": mockServer.URL + "/user",
		"github_emails":   mockServer.URL + "/user/emails",
	}
	service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 30 * time.Second}, baseURLs)

	// Test successful code exchange
	userInfo, tokenResp, err := service.ExchangeGitHubCode("test_code")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if userInfo == nil {
		t.Fatal("Expected user info, got nil")
	}

	if userInfo.ID != "987654321" {
		t.Errorf("Expected user ID '987654321', got '%s'", userInfo.ID)
	}

	if userInfo.Email != "test@example.com" {
		t.Errorf("Expected email 'test@example.com', got '%s'", userInfo.Email)
	}

	if userInfo.Username != "Test User" {
		t.Errorf("Expected username 'Test User', got '%s'", userInfo.Username)
	}

	if tokenResp == nil {
		t.Fatal("Expected token response, got nil")
	}

	if tokenResp.AccessToken != "mock_github_token" {
		t.Errorf("Expected access token 'mock_github_token', got '%s'", tokenResp.AccessToken)
	}
}

func TestOAuth2Service_HandleGitHubMissingEmail(t *testing.T) {
	// Setup mock server that returns user without email
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/access_token":
			tokenResp := map[string]interface{}{
				"access_token": "mock_github_token",
				"token_type":   "bearer",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(tokenResp)
		case "/user":
			// User without email
			userInfo := map[string]interface{}{
				"id":         987654321,
				"login":      "testuser",
				"name":       "Test User",
				"email":      nil, // No email
				"avatar_url": "https://github.com/avatar.jpg",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(userInfo)
		case "/user/emails":
			// Return empty emails array
			emails := []map[string]interface{}{}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(emails)
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	baseURLs := map[string]string{
		"github_token":    mockServer.URL + "/access_token",
		"github_userinfo": mockServer.URL + "/user",
		"github_emails":   mockServer.URL + "/user/emails",
	}
	service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 30 * time.Second}, baseURLs)

	userInfo, _, err := service.ExchangeGitHubCode("test_code")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	// Should handle missing email gracefully
	if userInfo.Email != "" {
		t.Errorf("Expected empty email, got '%s'", userInfo.Email)
	}
}

func TestOAuth2Service_ValidateProviderConfig(t *testing.T) {
	service := auth.NewOAuth2Service()

	// Test Google provider validation
	os.Setenv("GOOGLE_CLIENT_ID", "test_id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "test_secret")
	os.Setenv("FRONTEND_URL", "http://localhost:3000")

	err := service.ValidateProviderConfig("google")
	if err != nil {
		t.Errorf("Expected no error for valid Google config, got %v", err)
	}

	// Test missing client ID
	os.Unsetenv("GOOGLE_CLIENT_ID")
	err = service.ValidateProviderConfig("google")
	if err == nil {
		t.Error("Expected error for missing GOOGLE_CLIENT_ID")
	}

	// Test GitHub provider validation
	os.Setenv("GITHUB_CLIENT_ID", "test_id")
	os.Setenv("GITHUB_CLIENT_SECRET", "test_secret")

	err = service.ValidateProviderConfig("github")
	if err != nil {
		t.Errorf("Expected no error for valid GitHub config, got %v", err)
	}

	// Test unsupported provider
	err = service.ValidateProviderConfig("unsupported")
	if err == nil {
		t.Error("Expected error for unsupported provider")
	}
}

func TestOAuth2Service_ErrorHandling(t *testing.T) {
	// Setup mock server that returns OAuth2 errors
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			// Return OAuth2 error
			w.WriteHeader(http.StatusBadRequest)
			errorResp := map[string]interface{}{
				"error":             "invalid_grant",
				"error_description": "The provided authorization grant is invalid",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(errorResp)
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	baseURLs := map[string]string{
		"google_token": mockServer.URL + "/token",
	}
	service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 30 * time.Second}, baseURLs)

	// Test OAuth2 error handling
	_, _, err := service.ExchangeGoogleCode("invalid_code")
	if err == nil {
		t.Error("Expected error for invalid code")
	}

	// Check if it's an OAuth2Error
	if oauth2Err, ok := err.(*auth.OAuth2Error); ok {
		if oauth2Err.ErrorCode != "invalid_grant" {
			t.Errorf("Expected error code 'invalid_grant', got '%s'", oauth2Err.ErrorCode)
		}
	}
}

func TestOAuth2Service_RefreshGoogleToken(t *testing.T) {
	// Setup mock server for token refresh
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			tokenResp := map[string]interface{}{
				"access_token": "new_access_token",
				"token_type":   "Bearer",
				"expires_in":   3600,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(tokenResp)
		} else {
			http.NotFound(w, r)
		}
	}))
	defer mockServer.Close()

	os.Setenv("GOOGLE_CLIENT_ID", "test_client_id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "test_client_secret")

	baseURLs := map[string]string{
		"google_token": mockServer.URL + "/token",
	}
	service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 30 * time.Second}, baseURLs)

	tokenResp, err := service.RefreshGoogleToken("refresh_token")
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if tokenResp == nil {
		t.Fatal("Expected token response, got nil")
	}

	if tokenResp.AccessToken != "new_access_token" {
		t.Errorf("Expected access token 'new_access_token', got '%s'", tokenResp.AccessToken)
	}
}

// Test OAuth2 provider-specific edge cases
func TestOAuth2Service_ProviderEdgeCases(t *testing.T) {
	t.Run("Google missing required fields", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/token":
				tokenResp := map[string]interface{}{
					"access_token": "token",
					"token_type":   "Bearer",
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tokenResp)
			case "/userinfo":
				// Missing required ID field
				userInfo := map[string]interface{}{
					"email": "test@gmail.com",
					"name":  "Test User",
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(userInfo)
			}
		}))
		defer mockServer.Close()

		baseURLs := map[string]string{
			"google_token":    mockServer.URL + "/token",
			"google_userinfo": mockServer.URL + "/userinfo",
		}
		service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 30 * time.Second}, baseURLs)
		_, _, err := service.ExchangeGoogleCode("test_code")
		if err == nil {
			t.Error("Expected error for missing user ID")
		}
	})

	t.Run("GitHub rate limiting", func(t *testing.T) {
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/login/oauth/access_token":
				tokenResp := map[string]interface{}{
					"access_token": "token",
					"token_type":   "bearer",
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tokenResp)
			case "/user":
				// Simulate rate limiting
				w.WriteHeader(http.StatusTooManyRequests)
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", "1640995200")
			}
		}))
		defer mockServer.Close()

		baseURLs := map[string]string{
			"github_token":    mockServer.URL + "/access_token",
			"github_userinfo": mockServer.URL + "/user",
		}
		service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 30 * time.Second}, baseURLs)
		_, _, err := service.ExchangeGitHubCode("test_code")
		if err == nil {
			t.Error("Expected error for rate limiting")
		}
	})

	t.Run("Network timeout handling", func(t *testing.T) {
		// Create a server that delays response beyond timeout
		mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(35 * time.Second) // Longer than 30s timeout
			w.WriteHeader(http.StatusOK)
		}))
		defer mockServer.Close()

		baseURLs := map[string]string{
			"google_token": mockServer.URL + "/token",
		}
		service := auth.NewOAuth2ServiceWithClient(&http.Client{Timeout: 1 * time.Second}, baseURLs) // Short timeout
		_, _, err := service.ExchangeGoogleCode("test_code")
		if err == nil {
			t.Error("Expected timeout error")
		}
	})
}