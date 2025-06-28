package main

import (
	"fmt"
	"log"
	"os"
	"seaside/internals/middleware"
	"seaside/internals/video"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/etag"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"
	"time"
)

func setupRoutes(app *fiber.App) {
	video.AllRooms.Init()

	// Health check route
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"message": "✅ Backend is up and running! Go back to https://seasides.vercel.app/ and Create Room ID",
			"timestamp": time.Now().Unix(),
		})
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

	// Create room endpoint
	app.Get("/create-room", video.CreateRoomRequestHandler)

	// Join room WebSocket endpoint
	app.Get("/join-room", websocket.New(video.WebSocketJoinHandler, websocket.Config{
		// Enhanced WebSocket configuration
		Origins:         []string{"*"},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(c *fiber.Ctx) bool {
			// In production, implement proper origin checking
			return true
		},
		EnableCompression: true,
	}))
}

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error loading .env file:", err)
	}

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

	// Add recovery middleware
	app.Use(recover.New())

	// Add logger middleware with custom format
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} - ${ip} - ${latency}\n",
	}))

	// Add ETag middleware
	app.Use(etag.New())

	// Add CORS middleware
	app.Use(middleware.CorsConfig())

	// Setup routes
	setupRoutes(app)

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}