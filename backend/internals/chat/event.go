package chat

import (
	"log"

	"github.com/gofiber/websocket/v2"
)

// Global chat manager instance - shared across all connections
var ChatManagerInstance = NewChatManager()

// ChatWebSocketHandler is the main entry point for chat WebSocket connections
// This function is called when a client connects to the /chat endpoint
func ChatWebSocketHandler(c *websocket.Conn) {
	// Extract room ID and username from query parameters
	roomID := c.Query("roomID")
	username := c.Query("username")

	// Validate room ID
	if roomID == "" {
		log.Println("[Chat] roomID is missing in WebSocket connection")
		c.Close()
		return
	}

	// Set default username if not provided
	if username == "" {
		username = "Anonymous"
	}

	log.Printf("[Chat] New chat connection for room: %s, user: %s", roomID, username)

	// Create a new chat client for this connection
	client := NewChatClient(username, roomID, c, ChatManagerInstance)

	// Start handling the connection (this will run until client disconnects)
	client.HandleConnection()
}

// GetChatStats returns chat statistics for monitoring
// This can be called from other parts of the application
func GetChatStats() map[string]interface{} {
	return ChatManagerInstance.GetRoomStats()
}
