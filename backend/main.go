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
	"github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"
)

func setupRoutes(app *fiber.App) {
	video.AllRooms.Init()

	// WebSocket middleware
	app.Use("/join-room", func(c *fiber.Ctx) error {
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

	// Join room endpoints - remove the duplicate handler
	app.Get("/join-room", websocket.New(video.WebSocketJoinHandler, websocket.Config{
		// Allow all origins for development
		Origins: []string{"*"},
	}))

	// Serve static files

}

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error loading .env file:", err)
	}

	app := fiber.New(fiber.Config{
		AppName:           "RiverSide Clone v1.0.1",
		DisableKeepalive:  false,
		StreamRequestBody: true,
	})

	// Add logger middleware
	app.Use(logger.New())

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
