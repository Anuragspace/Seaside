package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// OAuth2Service handles OAuth2 provider integrations
type OAuth2Service struct {
	httpClient *http.Client
	baseURLs   map[string]string
}

// NewOAuth2Service creates a new OAuth2 service
func NewOAuth2Service() *OAuth2Service {
	return &OAuth2Service{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURLs: map[string]string{
			"google_token":    "https://oauth2.googleapis.com/token",
			"google_userinfo": "https://www.googleapis.com/oauth2/v2/userinfo",
			"github_token":    "https://github.com/login/oauth/access_token",
			"github_userinfo": "https://api.github.com/user",
			"github_emails":   "https://api.github.com/user/emails",
		},
	}
}

// NewOAuth2ServiceWithClient creates a new OAuth2 service with custom HTTP client and base URLs (for testing)
func NewOAuth2ServiceWithClient(client *http.Client, baseURLs map[string]string) *OAuth2Service {
	service := &OAuth2Service{
		httpClient: client,
		baseURLs: map[string]string{
			"google_token":    "https://oauth2.googleapis.com/token",
			"google_userinfo": "https://www.googleapis.com/oauth2/v2/userinfo",
			"github_token":    "https://github.com/login/oauth/access_token",
			"github_userinfo": "https://api.github.com/user",
			"github_emails":   "https://api.github.com/user/emails",
		},
	}
	
	// Override with custom URLs if provided
	if baseURLs != nil {
		for key, url := range baseURLs {
			service.baseURLs[key] = url
		}
	}
	
	return service
}

// OAuth2UserInfo represents user information from OAuth2 providers
type OAuth2UserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Username      string `json:"username"`
	Name          string `json:"name"`
	Avatar        string `json:"avatar"`
	EmailVerified bool   `json:"email_verified"`
}

// OAuth2TokenResponse represents the token response from OAuth2 providers
type OAuth2TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

// OAuth2Error represents OAuth2-specific errors
type OAuth2Error struct {
	Provider    string `json:"provider"`
	ErrorCode   string `json:"error"`
	Description string `json:"error_description"`
	URI         string `json:"error_uri,omitempty"`
}

func (e *OAuth2Error) Error() string {
	return fmt.Sprintf("OAuth2 error from %s: %s - %s", e.Provider, e.ErrorCode, e.Description)
}

// ExchangeGoogleCode exchanges Google authorization code for tokens and user info
func (s *OAuth2Service) ExchangeGoogleCode(code string) (*OAuth2UserInfo, *OAuth2TokenResponse, error) {
	// Exchange code for tokens
	tokenResp, err := s.exchangeGoogleCodeForTokens(code)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to exchange Google code for tokens: %w", err)
	}

	// Get user info using access token
	userInfo, err := s.getGoogleUserInfo(tokenResp.AccessToken)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get Google user info: %w", err)
	}

	return userInfo, tokenResp, nil
}

// ExchangeGitHubCode exchanges GitHub authorization code for tokens and user info
func (s *OAuth2Service) ExchangeGitHubCode(code string) (*OAuth2UserInfo, *OAuth2TokenResponse, error) {
	// Exchange code for tokens
	tokenResp, err := s.exchangeGitHubCodeForTokens(code)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to exchange GitHub code for tokens: %w", err)
	}

	// Get user info using access token
	userInfo, err := s.getGitHubUserInfo(tokenResp.AccessToken)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get GitHub user info: %w", err)
	}

	return userInfo, tokenResp, nil
}

// exchangeGoogleCodeForTokens exchanges Google authorization code for tokens
func (s *OAuth2Service) exchangeGoogleCodeForTokens(code string) (*OAuth2TokenResponse, error) {
	tokenURL := s.baseURLs["google_token"]
	
	data := url.Values{}
	data.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	data.Set("client_secret", os.Getenv("GOOGLE_CLIENT_SECRET"))
	data.Set("code", code)
	data.Set("grant_type", "authorization_code")
	data.Set("redirect_uri", os.Getenv("FRONTEND_URL")+"/auth/callback/google")

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var oauthErr OAuth2Error
		if err := json.NewDecoder(resp.Body).Decode(&oauthErr); err == nil {
			oauthErr.Provider = "google"
			return nil, &oauthErr
		}
		return nil, fmt.Errorf("token request failed with status: %d", resp.StatusCode)
	}

	var tokenResp OAuth2TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// Validate required fields
	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("access token not received from Google")
	}

	return &tokenResp, nil
}

// exchangeGitHubCodeForTokens exchanges GitHub authorization code for tokens
func (s *OAuth2Service) exchangeGitHubCodeForTokens(code string) (*OAuth2TokenResponse, error) {
	tokenURL := s.baseURLs["github_token"]
	
	data := url.Values{}
	data.Set("client_id", os.Getenv("GITHUB_CLIENT_ID"))
	data.Set("client_secret", os.Getenv("GITHUB_CLIENT_SECRET"))
	data.Set("code", code)

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var oauthErr OAuth2Error
		if err := json.NewDecoder(resp.Body).Decode(&oauthErr); err == nil {
			oauthErr.Provider = "github"
			return nil, &oauthErr
		}
		return nil, fmt.Errorf("token request failed with status: %d", resp.StatusCode)
	}

	var tokenResp OAuth2TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// Validate required fields
	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("access token not received from GitHub")
	}

	return &tokenResp, nil
}

// getGoogleUserInfo retrieves user information from Google
func (s *OAuth2Service) getGoogleUserInfo(accessToken string) (*OAuth2UserInfo, error) {
	userInfoURL := s.baseURLs["google_userinfo"]

	req, err := http.NewRequest("GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make user info request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info request failed with status: %d", resp.StatusCode)
	}

	var googleUser struct {
		ID            string `json:"id"`
		Email         string `json:"email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		VerifiedEmail bool   `json:"verified_email"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		return nil, fmt.Errorf("failed to decode user info response: %w", err)
	}

	// Validate required fields
	if googleUser.ID == "" {
		return nil, fmt.Errorf("user ID not received from Google")
	}
	if googleUser.Email == "" {
		return nil, fmt.Errorf("user email not received from Google")
	}

	// Generate username from name or email
	username := googleUser.Name
	if username == "" {
		username = strings.Split(googleUser.Email, "@")[0]
	}

	return &OAuth2UserInfo{
		ID:            googleUser.ID,
		Email:         googleUser.Email,
		Username:      username,
		Name:          googleUser.Name,
		Avatar:        googleUser.Picture,
		EmailVerified: googleUser.VerifiedEmail,
	}, nil
}

// getGitHubUserInfo retrieves user information from GitHub
func (s *OAuth2Service) getGitHubUserInfo(accessToken string) (*OAuth2UserInfo, error) {
	userInfoURL := s.baseURLs["github_userinfo"]

	req, err := http.NewRequest("GET", userInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Seaside-App/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make user info request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info request failed with status: %d", resp.StatusCode)
	}

	var githubUser struct {
		ID        int    `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&githubUser); err != nil {
		return nil, fmt.Errorf("failed to decode user info response: %w", err)
	}

	// Validate required fields
	if githubUser.ID == 0 {
		return nil, fmt.Errorf("user ID not received from GitHub")
	}
	if githubUser.Login == "" {
		return nil, fmt.Errorf("user login not received from GitHub")
	}

	// Handle missing email (GitHub allows users to keep email private)
	email := githubUser.Email
	if email == "" {
		// Try to get primary email from GitHub emails API
		email, _ = s.getGitHubPrimaryEmail(accessToken)
	}

	// Use login as username, fallback to name
	username := githubUser.Login
	if githubUser.Name != "" {
		username = githubUser.Name
	}

	return &OAuth2UserInfo{
		ID:            fmt.Sprintf("%d", githubUser.ID),
		Email:         email,
		Username:      username,
		Name:          githubUser.Name,
		Avatar:        githubUser.AvatarURL,
		EmailVerified: email != "", // Assume verified if we got an email
	}, nil
}

// getGitHubPrimaryEmail attempts to get the primary email from GitHub
func (s *OAuth2Service) getGitHubPrimaryEmail(accessToken string) (string, error) {
	emailsURL := s.baseURLs["github_emails"]

	req, err := http.NewRequest("GET", emailsURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create emails request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Seaside-App/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make emails request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("emails request failed with status: %d", resp.StatusCode)
	}

	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return "", fmt.Errorf("failed to decode emails response: %w", err)
	}

	// Find primary verified email
	for _, email := range emails {
		if email.Primary && email.Verified {
			return email.Email, nil
		}
	}

	// Fallback to first verified email
	for _, email := range emails {
		if email.Verified {
			return email.Email, nil
		}
	}

	return "", fmt.Errorf("no verified email found")
}

// RefreshGoogleToken refreshes a Google access token using refresh token
func (s *OAuth2Service) RefreshGoogleToken(refreshToken string) (*OAuth2TokenResponse, error) {
	tokenURL := s.baseURLs["google_token"]
	
	data := url.Values{}
	data.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	data.Set("client_secret", os.Getenv("GOOGLE_CLIENT_SECRET"))
	data.Set("refresh_token", refreshToken)
	data.Set("grant_type", "refresh_token")

	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create refresh request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make refresh request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var oauthErr OAuth2Error
		if err := json.NewDecoder(resp.Body).Decode(&oauthErr); err == nil {
			oauthErr.Provider = "google"
			return nil, &oauthErr
		}
		return nil, fmt.Errorf("refresh request failed with status: %d", resp.StatusCode)
	}

	var tokenResp OAuth2TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode refresh response: %w", err)
	}

	return &tokenResp, nil
}

// ValidateProviderConfig validates OAuth2 provider configuration
func (s *OAuth2Service) ValidateProviderConfig(provider string) error {
	switch provider {
	case "google":
		if os.Getenv("GOOGLE_CLIENT_ID") == "" {
			return fmt.Errorf("GOOGLE_CLIENT_ID environment variable is required")
		}
		if os.Getenv("GOOGLE_CLIENT_SECRET") == "" {
			return fmt.Errorf("GOOGLE_CLIENT_SECRET environment variable is required")
		}
	case "github":
		if os.Getenv("GITHUB_CLIENT_ID") == "" {
			return fmt.Errorf("GITHUB_CLIENT_ID environment variable is required")
		}
		if os.Getenv("GITHUB_CLIENT_SECRET") == "" {
			return fmt.Errorf("GITHUB_CLIENT_SECRET environment variable is required")
		}
	default:
		return fmt.Errorf("unsupported OAuth2 provider: %s", provider)
	}

	if os.Getenv("FRONTEND_URL") == "" {
		return fmt.Errorf("FRONTEND_URL environment variable is required")
	}

	return nil
}