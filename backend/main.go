package main

import (
	"log"
	"os"
	"time"

	"seaside/handlers"
	"seaside/internals/chat"
	"seaside/internals/middleware"
	"seaside/internals/video"
	"seaside/lib/auth"
	"seaside/lib/db"
	"seaside/lib/monitoring"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"
)

func loadEnv() {
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
	}
}

func setupRoutes(app *fiber.App, authHandlers *handlers.AuthHandlers, jwtUtil *auth.JWTUtil) {
	video.AllRooms.Init()

	// Basic routes
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "message": "Seaside API"})
	})
	
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "healthy"})
	})
	
	app.Get("/stats", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"rooms": video.AllRooms.GetRoomStats(),
			"system": monitoring.GlobalMetrics.GetSnapshot(),
		})
	})

	// WebSocket validation
	wsValidation := func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}

	// Auth routes
	auth := app.Group("/auth")
	auth.Post("/register", authHandlers.RegisterHandler)
	auth.Post("/login", authHandlers.LoginHandler)
	auth.Post("/refresh", authHandlers.RefreshTokenHandler)
	auth.Post("/logout", authHandlers.LogoutHandler)
	auth.Get("/oauth/state/:provider", authHandlers.GenerateOAuth2StateHandler)
	auth.Post("/oauth/google", authHandlers.GoogleOAuth2Handler)
	auth.Post("/oauth/github", authHandlers.GitHubOAuth2Handler)

	// Protected routes
	api := app.Group("/api", auth.JWTMiddleware(jwtUtil))
	api.Get("/me", authHandlers.GetMeHandler)

	// Room routes
	app.Get("/create-room", video.CreateRoomRequestHandler)
	app.Get("/join-room", wsValidation, websocket.New(video.WebSocketJoinHandler))
	app.Get("/chat", wsValidation, websocket.New(chat.ChatWebSocketHandler))
}

func main() {
	// Load environment
	loadEnv()

	// Initialize database
	if err := db.InitializeDatabase(); err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}

	// Setup components
	userRepo := db.NewUserRepository(db.DB)
	jwtUtil := auth.NewJWTUtil(os.Getenv("JWT_SECRET"))
	authHandlers := handlers.NewAuthHandlers(userRepo, jwtUtil)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Seaside API",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(middleware.CorsConfig())

	// Routes
	setupRoutes(app, authHandlers, jwtUtil)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Seaside API starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
