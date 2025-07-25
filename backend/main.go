package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"seaside/handlers"
	"seaside/internals/chat"
	"seaside/internals/middleware"
	"seaside/internals/video"
	"seaside/lib/auth"
	"seaside/lib/config"
	"seaside/lib/db"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/etag"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"
)

// logEnvironmentStatus logs the status of key environment variables
func logEnvironmentStatus() {
	envVars := map[string]string{
		"PORT":         os.Getenv("PORT"),
		"DATABASE_URL": os.Getenv("DATABASE_URL"),
		"JWT_SECRET":   os.Getenv("JWT_SECRET"),
		"GOOGLE_CLIENT_ID": os.Getenv("GOOGLE_CLIENT_ID"),
		"GOOGLE_CLIENT_SECRET": os.Getenv("GOOGLE_CLIENT_SECRET"),
		"GITHUB_CLIENT_ID": os.Getenv("GITHUB_CLIENT_ID"),
		"GITHUB_CLIENT_SECRET": os.Getenv("GITHUB_CLIENT_SECRET"),
	}

	log.Println("Environment variable status:")
	for key, value := range envVars {
		if value != "" {
			// Don't log sensitive values, just indicate they're set
			if key == "JWT_SECRET" || key == "DATABASE_URL" || 
			   key == "GOOGLE_CLIENT_SECRET" || key == "GITHUB_CLIENT_SECRET" {
				log.Printf("  ✅ %s: [SET]", key)
			} else {
				log.Printf("  ✅ %s: %s", key, value)
			}
		} else {
			log.Printf("  ❌ %s: [NOT SET]", key)
		}
	}
}

// validateRequiredEnvironmentVariables checks that all critical environment variables are set
func validateRequiredEnvironmentVariables() error {
	requiredVars := map[string]string{
		"DATABASE_URL": "Database connection string is required for application to function",
		"JWT_SECRET":   "JWT secret is required for authentication to work",
	}

	var missingVars []string
	var errorMessages []string

	log.Println("Validating required environment variables...")
	
	for key, description := range requiredVars {
		value := os.Getenv(key)
		if value == "" {
			missingVars = append(missingVars, key)
			errorMessages = append(errorMessages, fmt.Sprintf("- %s: %s", key, description))
			log.Printf("❌ Required variable %s is missing", key)
		} else {
			log.Printf("✅ Required variable %s is set", key)
		}
	}

	if len(missingVars) > 0 {
		errorMsg := fmt.Sprintf("Missing required environment variables:\n%s\n\nDeployment troubleshooting:\n- For Render: Set these variables in the Environment section of your service\n- For local development: Add these to your .env file\n- For Docker: Pass these as -e flags or in docker-compose.yml\n- For other platforms: Consult your platform's documentation for setting environment variables", strings.Join(errorMessages, "\n"))
		return fmt.Errorf(errorMsg)
	}

	log.Println("✅ All required environment variables are present")
	return nil
}

func setupRoutes(app *fiber.App, authHandlers *handlers.AuthHandlers, jwtUtil *auth.JWTUtil) {
	video.AllRooms.Init()

	// Health check route
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"message":   "✅ Backend is up and running! Go back to https://seasides.vercel.app/ and Create Room ID",
			"timestamp": time.Now().Unix(),
		})
	})

	// Database health check route
	app.Get("/health", func(c *fiber.Ctx) error {
		if db.GlobalHealthChecker == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "Health checker not initialized",
			})
		}
		
		healthStatus := db.GlobalHealthChecker.CheckHealth()
		
		// Set appropriate HTTP status based on health
		statusCode := fiber.StatusOK
		if healthStatus.Status == "unhealthy" {
			statusCode = fiber.StatusServiceUnavailable
		} else if healthStatus.Status == "degraded" {
			statusCode = fiber.StatusPartialContent
		}
		
		return c.Status(statusCode).JSON(healthStatus)
	})

	// Stats endpoint for monitoring
	app.Get("/stats", func(c *fiber.Ctx) error {
		stats := video.AllRooms.GetRoomStats()
		return c.JSON(stats)
	})

	// Rate limiting for room creation
	app.Use("/create-room", limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many room creation requests. Please try again later.",
			})
		},
	}))

	// WebSocket middleware with enhanced validation
	app.Use("/join-room", func(c *fiber.Ctx) error {
		// Validate room ID
		roomID := c.Query("roomID")
		if roomID == "" || len(roomID) < 6 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid room ID",
			})
		}

		// IsWebSocketUpgrade returns true if the client
		// requested upgrade to the WebSocket protocol.
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Use("/chat", func(c *fiber.Ctx) error {
		// validate the room id
		roomId := c.Query("roomID")
		if roomId == "" || len(roomId) < 6 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid room id",
			})
		}

		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("Allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// Authentication routes (public) with rate limiting
	authGroup := app.Group("/auth")
	
	// Rate limiting for authentication endpoints
	authRateLimit := limiter.New(limiter.Config{
		Max:        5, // 5 requests per minute
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many authentication requests. Please try again later.",
			})
		},
	})
	
	// OAuth2 state generation (less restrictive rate limit)
	oauthStateLimit := limiter.New(limiter.Config{
		Max:        10, // 10 requests per minute
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many state generation requests. Please try again later.",
			})
		},
	})
	
	authGroup.Post("/register", authRateLimit, authHandlers.RegisterHandler)
	authGroup.Post("/login", authRateLimit, authHandlers.LoginHandler)
	authGroup.Post("/refresh", authHandlers.RefreshTokenHandler)
	authGroup.Post("/logout", authHandlers.LogoutHandler)

	// OAuth2 routes
	authGroup.Get("/oauth/state/:provider", oauthStateLimit, authHandlers.GenerateOAuth2StateHandler)
	authGroup.Post("/oauth/google", authRateLimit, authHandlers.GoogleOAuth2Handler)
	authGroup.Post("/oauth/github", authRateLimit, authHandlers.GitHubOAuth2Handler)

	// Protected API routes
	api := app.Group("/api", auth.JWTMiddleware(jwtUtil))
	api.Get("/me", authHandlers.GetMeHandler)

	// Create room endpoint
	app.Get("/create-room", video.CreateRoomRequestHandler)

	// Join room WebSocket endpoint
	app.Get("/join-room", websocket.New(video.WebSocketJoinHandler, websocket.Config{
		// Enhanced WebSocket configuration
		Origins:           []string{"*"},
		ReadBufferSize:    1024,
		WriteBufferSize:   1024,
		EnableCompression: true,
	}))

	// Chat WebSocket endpoint
	app.Get("/chat", websocket.New(chat.ChatWebSocketHandler, websocket.Config{
		// Enhanced WebSocket configuration
		Origins:         []string{"*"},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,

		EnableCompression: true,
	}))
}

func main() {
	log.Println("=== Seaside Application Startup ===")
	log.Printf("Starting Seaside Clone v1.0.2 at %s", time.Now().Format(time.RFC3339))
	
	// Step 1: Initialize deployment-specific configuration
	log.Println("Step 1: Initializing deployment configuration...")
	deploymentConfig := config.NewDeploymentConfig()
	
	// Step 2: Load environment configuration with deployment-specific handling
	log.Println("Step 2: Loading environment configuration...")
	if deploymentConfig.ShouldLoadEnvFile() {
		// Try to find and load environment-specific .env file
		if envFile, err := deploymentConfig.FindConfigFile(".env"); err == nil {
			log.Printf("Attempting to load environment file: %s", envFile)
			if err := godotenv.Load(envFile); err != nil {
				log.Printf("Warning: Could not load .env file from %s (%v). Using system environment variables.", envFile, err)
			} else {
				log.Printf("Successfully loaded .env file from: %s", envFile)
			}
		} else {
			log.Printf("Warning: No .env file found using deployment-specific paths (%v). Using system environment variables.", err)
		}
	} else {
		log.Printf("Skipping .env file loading for %s platform - using system environment variables", deploymentConfig.Platform)
	}

	// Log key environment variables being used (without sensitive values)
	logEnvironmentStatus()

	// Validate required environment variables before proceeding
	if err := validateRequiredEnvironmentVariables(); err != nil {
		log.Fatalf("Environment validation failed: %v", err)
	}

	// Initialize database with deployment configuration
	log.Println("Step 3: Initializing database connection...")
	if err := db.InitializeDatabaseWithConfig(deploymentConfig); err != nil {
		log.Fatalf("❌ Database initialization failed: %v", err)
	}
	log.Println("✅ Database initialization completed successfully")

	// Step 4: Initialize application components
	log.Println("Step 4: Initializing application components...")
	
	// Create repository
	log.Println("Creating user repository...")
	userRepo := db.NewUserRepository(db.DB)
	log.Println("✅ User repository created")

	// Create JWT utility
	log.Println("Initializing JWT utility...")
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("❌ JWT_SECRET environment variable is required")
	}
	jwtUtil := auth.NewJWTUtil(jwtSecret)
	log.Println("✅ JWT utility initialized")

	// Create handlers
	log.Println("Creating authentication handlers...")
	authHandlers := handlers.NewAuthHandlers(userRepo, jwtUtil)
	log.Println("✅ Authentication handlers created")

	// Step 5: Initialize Fiber application
	log.Println("Step 5: Initializing Fiber web server...")
	app := fiber.New(fiber.Config{
		AppName:           "Seaside Clone v1.0.2",
		DisableKeepalive:  false,
		StreamRequestBody: true,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	log.Println("✅ Fiber application initialized")

	// Step 6: Configure middleware
	log.Println("Step 6: Configuring middleware...")
	
	// Add recovery middleware
	app.Use(recover.New())
	log.Println("✅ Recovery middleware added")

	// Add logger middleware with custom format
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} - ${ip} - ${latency}\n",
	}))
	log.Println("✅ Request logger middleware added")

	// Add ETag middleware
	app.Use(etag.New())
	log.Println("✅ ETag middleware added")

	// Add CORS middleware
	app.Use(middleware.CorsConfig())
	log.Println("✅ CORS middleware added")

	// Step 7: Setup application routes
	log.Println("Step 7: Setting up application routes...")
	setupRoutes(app, authHandlers, jwtUtil)
	log.Println("✅ Application routes configured")

	// Step 8: Start server
	log.Println("Step 8: Starting HTTP server...")
	
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s", port)
	log.Printf("🌐 Health check available at: http://localhost:%s/health", port)
	log.Printf("📊 Stats endpoint available at: http://localhost:%s/stats", port)
	log.Println("=== Startup Complete - Server Ready ===")
	
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("❌ Error starting server: %v", err)
	}
}
