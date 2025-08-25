package handlers

import (
	"fmt"
	"strings"
	"time"

	"seaside/lib/auth"
	"seaside/lib/db"

	"github.com/gofiber/fiber/v2"
)

type AuthHandlers struct {
	userRepo       db.UserRepositoryInterface  // abstracts database operations
	jwtUtil        *auth.JWTUtil
	passwordUtil   *auth.PasswordUtil
	validationUtil *auth.ValidationUtil
	stateManager   *auth.OAuth2StateManager
	oauth2Service  *auth.OAuth2Service
}

func NewAuthHandlers(userRepo db.UserRepositoryInterface, jwtUtil *auth.JWTUtil) *AuthHandlers {
	return &AuthHandlers{
		userRepo:       userRepo,
		jwtUtil:        jwtUtil,
		passwordUtil:   auth.NewPasswordUtil(),
		validationUtil: auth.NewValidationUtil(),
		stateManager:   auth.NewOAuth2StateManager(),
		oauth2Service:  auth.NewOAuth2Service(),
	}
}

type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email,no_sql_injection"`
	Username string `json:"username" validate:"required,min=3,max=30,safe_username,no_sql_injection"`
	Password string `json:"password" validate:"required,strong_password,no_sql_injection"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email,no_sql_injection"`
	Password string `json:"password" validate:"required,no_sql_injection"`
}

type OAuth2CallbackRequest struct {
	Code  string `json:"code" validate:"required,no_sql_injection"`
	State string `json:"state" validate:"required,no_sql_injection"`
}

func (h *AuthHandlers) RegisterHandler(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate input
	if err := h.validationUtil.ValidateStruct(&req); err != nil {
		errors := h.validationUtil.GetValidationErrors(err)
		return c.Status(400).JSON(fiber.Map{
			"error":  "Validation failed",
			"errors": errors,
		})
	}

	// Sanitize inputs
	sanitizedEmail, err := h.validationUtil.SanitizeEmail(req.Email)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	sanitizedUsername, err := h.validationUtil.SanitizeUsername(req.Username)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	// Validate password strength
	if err := h.passwordUtil.ValidatePasswordStrength(req.Password); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	// Hash password
	hashedPassword, err := h.passwordUtil.HashPassword(req.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to process password"})
	}

	user := &db.User{
		Email:        sanitizedEmail,
		Username:     sanitizedUsername,
		PasswordHash: hashedPassword,
		Active:       true,
		Provider:     "email",
	}

	if err := h.userRepo.CreateUser(user); err != nil {
		if strings.Contains(err.Error(), "email already exists") {
			return c.Status(409).JSON(fiber.Map{"error": "Email already registered"})
		}
		if strings.Contains(err.Error(), "username already exists") {
			return c.Status(409).JSON(fiber.Map{"error": "Username already taken"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
	}

	accessToken, refreshToken, err := h.jwtUtil.GenerateTokens(user.ID, user.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate tokens"})
	}

	refreshTokenRecord := &db.RefreshToken{
		UserID:    user.ID,
		TokenHash: h.jwtUtil.HashToken(refreshToken),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	h.userRepo.CreateRefreshToken(refreshTokenRecord)

	return c.Status(201).JSON(fiber.Map{
		"message": "User created successfully",
		"user": fiber.Map{
			"id":       fmt.Sprintf("%d", user.ID),
			"email":    user.Email,
			"username": user.Username,
			"avatar":   user.AvatarURL,
			"provider": user.Provider,
		},
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
		"expiresIn":    3600, // 1 hour in seconds
	})
}

func (h *AuthHandlers) LoginHandler(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate input
	if err := h.validationUtil.ValidateStruct(&req); err != nil {
		errors := h.validationUtil.GetValidationErrors(err)
		return c.Status(400).JSON(fiber.Map{
			"error":  "Validation failed",
			"errors": errors,
		})
	}

	// Sanitize email
	sanitizedEmail, err := h.validationUtil.SanitizeEmail(req.Email)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid email format"})
	}

	// Sanitize password input (but don't validate strength for login)
	sanitizedPassword := h.validationUtil.SanitizeInput(req.Password)

	user, err := h.userRepo.GetUserByEmail(sanitizedEmail)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if !user.Active {
		return c.Status(401).JSON(fiber.Map{"error": "Account is disabled"})
	}

	if err := h.passwordUtil.ComparePassword(user.PasswordHash, sanitizedPassword); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	h.userRepo.UpdateLastLogin(user.ID)

	accessToken, refreshToken, err := h.jwtUtil.GenerateTokens(user.ID, user.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate tokens"})
	}

	refreshTokenRecord := &db.RefreshToken{
		UserID:    user.ID,
		TokenHash: h.jwtUtil.HashToken(refreshToken),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	h.userRepo.CreateRefreshToken(refreshTokenRecord)

	return c.JSON(fiber.Map{
		"message": "Login successful",
		"user": fiber.Map{
			"id":       fmt.Sprintf("%d", user.ID),
			"email":    user.Email,
			"username": user.Username,
			"avatar":   user.AvatarURL,
			"provider": user.Provider,
		},
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
		"expiresIn":    3600, 
	})
}

func (h *AuthHandlers) GetMeHandler(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(uint)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid user context"})
	}

	user, err := h.userRepo.GetUserByID(userID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{
		"id":         fmt.Sprintf("%d", user.ID), // Convert to string for frontend
		"email":      user.Email,
		"username":   user.Username,
		"avatar":     user.AvatarURL,
		"provider":   user.Provider,
		"created_at": user.CreatedAt,
	})
}

func (h *AuthHandlers) RefreshTokenHandler(c *fiber.Ctx) error {
	var req struct {
		RefreshToken string `json:"refresh_token" validate:"required,no_sql_injection"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate input
	if err := h.validationUtil.ValidateStruct(&req); err != nil {
		errors := h.validationUtil.GetValidationErrors(err)
		return c.Status(400).JSON(fiber.Map{
			"error":  "Validation failed",
			"errors": errors,
		})
	}

	// Sanitize refresh token
	sanitizedToken := h.validationUtil.SanitizeInput(req.RefreshToken)

	claims, err := h.jwtUtil.ValidateRefreshToken(sanitizedToken)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid refresh token"})
	}

	tokenHash := h.jwtUtil.HashToken(sanitizedToken)
	storedToken, err := h.userRepo.GetRefreshToken(tokenHash)
	if err != nil || storedToken.Revoked {
		return c.Status(401).JSON(fiber.Map{"error": "Refresh token not found or revoked"})
	}

	accessToken, refreshToken, err := h.jwtUtil.GenerateTokens(claims.UserID, claims.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate tokens"})
	}

	h.userRepo.RevokeRefreshToken(tokenHash)

	newRefreshTokenRecord := &db.RefreshToken{
		UserID:    claims.UserID,
		TokenHash: h.jwtUtil.HashToken(refreshToken),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	h.userRepo.CreateRefreshToken(newRefreshTokenRecord)

	return c.JSON(fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *AuthHandlers) LogoutHandler(c *fiber.Ctx) error {
	var req struct {
		RefreshToken string `json:"refresh_token" validate:"required,no_sql_injection"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate input
	if err := h.validationUtil.ValidateStruct(&req); err != nil {
		errors := h.validationUtil.GetValidationErrors(err)
		return c.Status(400).JSON(fiber.Map{
			"error":  "Validation failed",
			"errors": errors,
		})
	}

	// Sanitize refresh token
	sanitizedToken := h.validationUtil.SanitizeInput(req.RefreshToken)
	tokenHash := h.jwtUtil.HashToken(sanitizedToken)
	h.userRepo.RevokeRefreshToken(tokenHash)

	return c.JSON(fiber.Map{"message": "Logged out successfully"})
}

func (h *AuthHandlers) GoogleOAuth2Handler(c *fiber.Ctx) error {
	var req OAuth2CallbackRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate input
	if err := h.validationUtil.ValidateStruct(&req); err != nil {
		errors := h.validationUtil.GetValidationErrors(err)
		return c.Status(400).JSON(fiber.Map{
			"error":  "Validation failed",
			"errors": errors,
		})
	}

	// Validate OAuth2 state for CSRF protection
	if err := h.stateManager.ValidateState(req.State, c.IP(), "google"); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid or expired state parameter"})
	}

	// Validate provider configuration
	if err := h.oauth2Service.ValidateProviderConfig("google"); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "OAuth2 provider configuration error"})
	}

	// Exchange code for tokens and user info
	userInfo, tokenResp, err := h.oauth2Service.ExchangeGoogleCode(req.Code)
	if err != nil {
		// Handle OAuth2-specific errors
		if oauth2Err, ok := err.(*auth.OAuth2Error); ok {
			return c.Status(400).JSON(fiber.Map{
				"error":       "OAuth2 authentication failed",
				"provider":    oauth2Err.Provider,
				"error_code":  oauth2Err.ErrorCode,
				"description": oauth2Err.Description,
			})
		}
		return c.Status(400).JSON(fiber.Map{"error": "Failed to exchange Google authorization code"})
	}

	// Process OAuth2 user and store tokens
	user, isNewUser, err := h.processOAuth2UserWithTokens(userInfo, tokenResp, "google")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to process OAuth2 user"})
	}

	// Generate JWT tokens for our application
	accessToken, refreshToken, err := h.jwtUtil.GenerateTokens(user.ID, user.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate tokens"})
	}

	// Store refresh token
	refreshTokenRecord := &db.RefreshToken{
		UserID:    user.ID,
		TokenHash: h.jwtUtil.HashToken(refreshToken),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	h.userRepo.CreateRefreshToken(refreshTokenRecord)
	h.userRepo.UpdateLastLogin(user.ID)

	return c.JSON(fiber.Map{
		"message":  "Google OAuth2 login successful",
		"new_user": isNewUser,
		"user": fiber.Map{
			"id":         user.ID,
			"email":      user.Email,
			"username":   user.Username,
			"avatar_url": user.AvatarURL,
			"provider":   user.Provider,
		},
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *AuthHandlers) GitHubOAuth2Handler(c *fiber.Ctx) error {
	var req OAuth2CallbackRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate input
	if err := h.validationUtil.ValidateStruct(&req); err != nil {
		errors := h.validationUtil.GetValidationErrors(err)
		return c.Status(400).JSON(fiber.Map{
			"error":  "Validation failed",
			"errors": errors,
		})
	}

	// Validate OAuth2 state for CSRF protection
	if err := h.stateManager.ValidateState(req.State, c.IP(), "github"); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid or expired state parameter"})
	}

	// Validate provider configuration
	if err := h.oauth2Service.ValidateProviderConfig("github"); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "OAuth2 provider configuration error"})
	}

	// Exchange code for tokens and user info
	userInfo, tokenResp, err := h.oauth2Service.ExchangeGitHubCode(req.Code)
	if err != nil {
		// Handle OAuth2-specific errors
		if oauth2Err, ok := err.(*auth.OAuth2Error); ok {
			return c.Status(400).JSON(fiber.Map{
				"error":       "OAuth2 authentication failed",
				"provider":    oauth2Err.Provider,
				"error_code":  oauth2Err.ErrorCode,
				"description": oauth2Err.Description,
			})
		}
		return c.Status(400).JSON(fiber.Map{"error": "Failed to exchange GitHub authorization code"})
	}

	// Handle GitHub-specific edge case: missing email
	if userInfo.Email == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "GitHub account must have a verified email address",
			"hint":  "Please add and verify an email address in your GitHub account settings",
		})
	}

	// Process OAuth2 user and store tokens
	user, isNewUser, err := h.processOAuth2UserWithTokens(userInfo, tokenResp, "github")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to process OAuth2 user"})
	}

	// Generate JWT tokens for our application
	accessToken, refreshToken, err := h.jwtUtil.GenerateTokens(user.ID, user.Email)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate tokens"})
	}

	// Store refresh token
	refreshTokenRecord := &db.RefreshToken{
		UserID:    user.ID,
		TokenHash: h.jwtUtil.HashToken(refreshToken),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}
	h.userRepo.CreateRefreshToken(refreshTokenRecord)
	h.userRepo.UpdateLastLogin(user.ID)

	return c.JSON(fiber.Map{
		"message":  "GitHub OAuth2 login successful",
		"new_user": isNewUser,
		"user": fiber.Map{
			"id":         user.ID,
			"email":      user.Email,
			"username":   user.Username,
			"avatar_url": user.AvatarURL,
			"provider":   user.Provider,
		},
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

// OAuth2UserInfo is now imported from auth package

// OAuth2 exchange methods are now handled by the OAuth2Service

func (h *AuthHandlers) processOAuth2UserWithTokens(userInfo *auth.OAuth2UserInfo, tokenResp *auth.OAuth2TokenResponse, provider string) (*db.User, bool, error) {
	// Check if OAuth provider already exists
	oauthProvider, err := h.userRepo.GetOAuthProvider(provider, userInfo.ID)
	if err == nil {
		// Update existing OAuth provider with new tokens
		oauthProvider.AccessToken = tokenResp.AccessToken
		oauthProvider.RefreshToken = tokenResp.RefreshToken
		if tokenResp.ExpiresIn > 0 {
			oauthProvider.ExpiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
		} else {
			oauthProvider.ExpiresAt = time.Now().Add(24 * time.Hour) // Default 24 hours
		}
		
		if err := h.userRepo.UpdateOAuthProvider(oauthProvider); err != nil {
			return nil, false, fmt.Errorf("failed to update OAuth provider: %w", err)
		}

		user, err := h.userRepo.GetUserByID(oauthProvider.UserID)
		if err != nil {
			return nil, false, fmt.Errorf("failed to get user: %w", err)
		}
		
		// Update user avatar if provided
		if userInfo.Avatar != "" && (user.AvatarURL == nil || *user.AvatarURL != userInfo.Avatar) {
			user.AvatarURL = &userInfo.Avatar
			h.userRepo.UpdateUser(user)
		}
		
		return user, false, nil
	}

	// Check if user exists by email
	existingUser, err := h.userRepo.GetUserByEmail(userInfo.Email)
	if err == nil {
		// Link OAuth provider to existing user
		newOAuthProvider := &db.OAuthProvider{
			UserID:       existingUser.ID,
			Provider:     provider,
			ProviderID:   userInfo.ID,
			AccessToken:  tokenResp.AccessToken,
			RefreshToken: tokenResp.RefreshToken,
			ExpiresAt:    time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second),
		}
		
		if tokenResp.ExpiresIn <= 0 {
			newOAuthProvider.ExpiresAt = time.Now().Add(24 * time.Hour) // Default 24 hours
		}
		
		if err := h.userRepo.CreateOAuthProvider(newOAuthProvider); err != nil {
			return nil, false, fmt.Errorf("failed to create OAuth provider: %w", err)
		}
		
		// Update user avatar if provided and different
		if userInfo.Avatar != "" && (existingUser.AvatarURL == nil || *existingUser.AvatarURL != userInfo.Avatar) {
			existingUser.AvatarURL = &userInfo.Avatar
			h.userRepo.UpdateUser(existingUser)
		}
		
		return existingUser, false, nil
	}

	// Create new user
	username := h.generateUniqueUsername(userInfo.Username, userInfo.Email)

	newUser := &db.User{
		Email:         userInfo.Email,
		Username:      username,
		PasswordHash:  "", // OAuth users don't have passwords
		AvatarURL:     &userInfo.Avatar,
		Provider:      provider,
		ProviderID:    userInfo.ID,
		EmailVerified: userInfo.EmailVerified,
		Active:        true,
	}

	if err := h.userRepo.CreateUser(newUser); err != nil {
		return nil, false, fmt.Errorf("failed to create user: %w", err)
	}

	// Create OAuth provider record with tokens
	newOAuthProvider := &db.OAuthProvider{
		UserID:       newUser.ID,
		Provider:     provider,
		ProviderID:   userInfo.ID,
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresAt:    time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second),
	}
	
	if tokenResp.ExpiresIn <= 0 {
		newOAuthProvider.ExpiresAt = time.Now().Add(24 * time.Hour) // Default 24 hours
	}

	if err := h.userRepo.CreateOAuthProvider(newOAuthProvider); err != nil {
		return nil, false, fmt.Errorf("failed to create OAuth provider: %w", err)
	}

	return newUser, true, nil
}

// generateUniqueUsername generates a unique username from the provided username or email
func (h *AuthHandlers) generateUniqueUsername(preferredUsername, email string) string {
	username := preferredUsername
	if username == "" {
		username = strings.Split(email, "@")[0]
	}

	// Sanitize username
	username = h.validationUtil.SanitizeInput(username)
	
	// Ensure username meets requirements
	if len(username) < 3 {
		username = "user" + username
	}
	if len(username) > 30 {
		username = username[:30]
	}

	// Check if username is unique
	originalUsername := username
	counter := 1
	for {
		_, err := h.userRepo.GetUserByUsername(username)
		if err != nil {
			// Username is available
			break
		}
		username = fmt.Sprintf("%s%d", originalUsername, counter)
		counter++
		
		// Prevent infinite loop
		if counter > 1000 {
			username = fmt.Sprintf("user%d", time.Now().Unix())
			break
		}
	}

	return username
}

// HTTP request methods are now handled by the OAuth2Service

// GenerateOAuth2StateHandler generates a state parameter for OAuth2 flow
func (h *AuthHandlers) GenerateOAuth2StateHandler(c *fiber.Ctx) error {
	provider := c.Params("provider")
	if provider != "google" && provider != "github" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid OAuth2 provider"})
	}

	state, err := h.stateManager.GenerateState(c.IP(), provider)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate state parameter"})
	}

	return c.JSON(fiber.Map{
		"state":    state,
		"provider": provider,
	})
}