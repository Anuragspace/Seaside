package chat

import (
	"log"

	"github.com/gofiber/websocket/v2"
)

var sharedChatManager = NewChatManager()

// client connects to the chat endpoint
func ChatWebSocketHandler(c *websocket.Conn) {
	roomId := c.Query("roomID")
	userId := c.Query("username")

	if roomId == "" {
		log.Println("room id is missing")
		c.Close()
		return
	}

	if userId == "" {
		userId = "null_admin"
	}

	log.Printf("[Chat] New chat connection for room: %s, user: %s", roomId, userId)

	// create a new client
	client := NewChatClient(userId, roomId, c, sharedChatManager)

	// start the connection
	client.HandleConnection()
}

// get the statistics for the chat features that has been implemented
func GetChatStats() map[string]interface{} {
	return sharedChatManager.GetRoomStats()
}
