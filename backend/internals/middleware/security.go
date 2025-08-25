package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/csrf"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// SecurityConfig applies comprehensive security middleware
func SecurityConfig() fiber.Handler {
	return helmet.New(helmet.Config{
		XSSProtection:         "1; mode=block",
		ContentTypeNosniff:    "nosniff",
		XFrameOptions:         "DENY",
		HSTSMaxAge:            31536000,
		HSTSIncludeSubdomains: true,
		ReferrerPolicy:        "strict-origin-when-cross-origin",
		CSPReportOnly:         false,
		ContentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; font-src 'self' https:; object-src 'none'; media-src 'self' https:; frame-src 'none';",
	})
}

// CSRFConfig provides CSRF protection for state-changing operations
func CSRFConfig() fiber.Handler {
	return csrf.New(csrf.Config{
		KeyLookup:      "header:X-CSRF-Token",
		CookieName:     "csrf_token",
		CookieSameSite: "Strict",
		CookieSecure:   true,
		CookieHTTPOnly: true,
		Expiration:     1 * time.Hour,
		KeyGenerator: func() string {
			bytes := make([]byte, 32)
			rand.Read(bytes)
			return hex.EncodeToString(bytes)
		},
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "CSRF token validation failed",
			})
		},
		Extractor: func(c *fiber.Ctx) (string, error) {
			// Try header first
			token := c.Get("X-CSRF-Token")
			if token != "" {
				return token, nil
			}
			// Try form field as fallback
			return c.FormValue("csrf_token"), nil
		},
	})
}

// RateLimitConfig provides configurable rate limiting
func RateLimitConfig(max int, window time.Duration, message string) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        max,
		Expiration: window,
		KeyGenerator: func(c *fiber.Ctx) string {
			// Use IP + User-Agent for more granular limiting
			return c.IP() + ":" + c.Get("User-Agent")
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "Rate limit exceeded",
				"message": message,
				"retry_after": window.Seconds(),
			})
		},
		SkipFailedRequests:     true,
		SkipSuccessfulRequests: false,
	})
}

// IPWhitelistConfig allows only whitelisted IPs (for admin endpoints)
func IPWhitelistConfig(allowedIPs []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		clientIP := c.IP()
		
		// Allow localhost in development
		if clientIP == "127.0.0.1" || clientIP == "::1" {
			return c.Next()
		}
		
		for _, allowedIP := range allowedIPs {
			if clientIP == allowedIP {
				return c.Next()
			}
		}
		
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied from this IP address",
		})
	}
}

// RequestSizeLimit limits request body size
func RequestSizeLimit(maxSize int) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Request().Header.ContentLength() > int64(maxSize) {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error": "Request body too large",
				"max_size": maxSize,
			})
		}
		return c.Next()
	}
}

// UserAgentFilter blocks suspicious user agents
func UserAgentFilter() fiber.Handler {
	suspiciousAgents := []string{
		"bot", "crawler", "spider", "scraper", "curl", "wget",
		"python-requests", "go-http-client", "java/", "php/",
	}
	
	return func(c *fiber.Ctx) error {
		userAgent := strings.ToLower(c.Get("User-Agent"))
		
		for _, suspicious := range suspiciousAgents {
			if strings.Contains(userAgent, suspicious) {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "Automated requests not allowed",
				})
			}
		}
		
		return c.Next()
	}
}

// APIKeyAuth provides API key authentication for service-to-service calls
func APIKeyAuth(validKeys []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		apiKey := c.Get("X-API-Key")
		if apiKey == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "API key required",
			})
		}
		
		for _, validKey := range validKeys {
			if apiKey == validKey {
				return c.Next()
			}
		}
		
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid API key",
		})
	}
}