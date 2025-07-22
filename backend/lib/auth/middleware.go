package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// JWTMiddleware creates a JWT authentication middleware
func JWTMiddleware(jwtUtil *JWTUtil) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get token from header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": "Authorization header required",
				"code":  "MISSING_TOKEN",
			})
		}

		// Extract token (remove "Bearer " prefix)
		tokenString := jwtUtil.ExtractTokenFromHeader(authHeader)
		if tokenString == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid authorization header format",
				"code":  "INVALID_TOKEN_FORMAT",
			})
		}

		// Validate access token
		claims, err := jwtUtil.ValidateAccessToken(tokenString)
		if err != nil {
			if strings.Contains(err.Error(), "expired") {
				return c.Status(401).JSON(fiber.Map{
					"error": "Token expired",
					"code":  "TOKEN_EXPIRED",
				})
			}
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid token",
				"code":  "INVALID_TOKEN",
			})
		}

		// Store user info in context
		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)

		return c.Next()
	}
}

// OptionalJWTMiddleware creates an optional JWT middleware (doesn't fail if no token)
func OptionalJWTMiddleware(jwtUtil *JWTUtil) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get token from header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Next() // Continue without authentication
		}

		// Extract token
		tokenString := jwtUtil.ExtractTokenFromHeader(authHeader)
		if tokenString == "" {
			return c.Next() // Continue without authentication
		}

		// Validate token
		claims, err := jwtUtil.ValidateAccessToken(tokenString)
		if err != nil {
			return c.Next() // Continue without authentication
		}

		// Store user info in context
		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("authenticated", true)

		return c.Next()
	}
}
