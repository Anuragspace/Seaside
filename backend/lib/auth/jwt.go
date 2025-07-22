package auth

import (
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTUtil struct {
	secretKey []byte
}

type Claims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	Type   string `json:"type"` // "access" or "refresh"
	jwt.RegisteredClaims
}

func NewJWTUtil(secretKey string) *JWTUtil {
	return &JWTUtil{
		secretKey: []byte(secretKey),
	}
}

// GenerateTokens generates both access and refresh tokens
func (j *JWTUtil) GenerateTokens(userID uint, email string) (accessToken, refreshToken string, err error) {
	// Generate access token (15 minutes)
	accessToken, err = j.generateToken(userID, email, "access", 15*time.Minute)
	if err != nil {
		return "", "", err
	}

	// Generate refresh token (7 days)
	refreshToken, err = j.generateToken(userID, email, "refresh", 7*24*time.Hour)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// generateToken creates a JWT token with specified type and duration
func (j *JWTUtil) generateToken(userID uint, email, tokenType string, duration time.Duration) (string, error) {
	claims := &Claims{
		UserID: userID,
		Email:  email,
		Type:   tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   fmt.Sprintf("%d", userID),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(j.secretKey)
}

// ValidateAccessToken validates an access token
func (j *JWTUtil) ValidateAccessToken(tokenString string) (*Claims, error) {
	return j.validateToken(tokenString, "access")
}

// ValidateRefreshToken validates a refresh token
func (j *JWTUtil) ValidateRefreshToken(tokenString string) (*Claims, error) {
	return j.validateToken(tokenString, "refresh")
}

// validateToken validates a token and checks its type
func (j *JWTUtil) validateToken(tokenString, expectedType string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return j.secretKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		// Check token type
		if claims.Type != expectedType {
			return nil, fmt.Errorf("invalid token type: expected %s, got %s", expectedType, claims.Type)
		}

		// Check if token is expired
		if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
			return nil, fmt.Errorf("token is expired")
		}

		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// HashToken creates a hash of the token for storage
func (j *JWTUtil) HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", hash)
}

// ExtractTokenFromHeader extracts token from Authorization header
func (j *JWTUtil) ExtractTokenFromHeader(authHeader string) string {
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	return ""
}
