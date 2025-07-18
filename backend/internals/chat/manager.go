package chat

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"
)

// ChatMessage represents a chat message with all necessary fields
type ChatMessage struct {
	Type      string    `json:"type"`      // Type: "chat", "system", "join", "leave", "typing"
	Text      string    `json:"text"`      // The actual message text
	From      string    `json:"from"`      // Who sent the message
	Timestamp time.Time `json:"timestamp"` // When the message was sent
	RoomID    string    `json:"roomId"`    // Which room the message belongs to
}

// ChatParticipant represents a user in a chat room
type ChatParticipant struct {
	ID       string          // Unique participant ID
	Username string          // Display name
	Conn     *websocket.Conn // WebSocket connection
	RoomID   string          // Which room they're in
}

// ChatManager handles all chat functionality across multiple rooms
type ChatManager struct {
	rooms map[string][]*ChatParticipant // Map of roomID -> list of participants
	mutex sync.RWMutex                  // Thread-safe access to rooms
}

// NewChatManager creates a new chat manager instance
func NewChatManager() *ChatManager {
	return &ChatManager{
		rooms: make(map[string][]*ChatParticipant), // Initialize empty rooms map
	}
}

// AddParticipant adds a new user to a chat room
func (cm *ChatManager) AddParticipant(roomID, userID, username string, conn *websocket.Conn) {
	cm.mutex.Lock()         // Lock for writing
	defer cm.mutex.Unlock() // Always unlock when function exits

	// Create new participant
	participant := &ChatParticipant{
		ID:       userID,
		Username: username,
		Conn:     conn,
		RoomID:   roomID,
	}

	// Add to room
	cm.rooms[roomID] = append(cm.rooms[roomID], participant)

	// Send join notification to all participants in the room
	joinMsg := ChatMessage{
		Type:      "join",
		Text:      username + " joined the chat",
		From:      "system",
		Timestamp: time.Now(),
		RoomID:    roomID,
	}
	cm.broadcastToRoom(roomID, joinMsg, nil) // nil = don't exclude anyone

	log.Printf("[Chat] %s joined room %s", username, roomID)
}

// RemoveParticipant removes a user from a chat room
func (cm *ChatManager) RemoveParticipant(roomID, userID string) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()

	participants, exists := cm.rooms[roomID]
	if !exists {
		return // Room doesn't exist
	}

	var username string
	var newParticipants []*ChatParticipant

	// Filter out the leaving participant
	for _, p := range participants {
		if p.ID != userID {
			newParticipants = append(newParticipants, p)
		} else {
			username = p.Username // Remember who left
		}
	}

	// Update room
	if len(newParticipants) == 0 {
		delete(cm.rooms, roomID) // Delete empty room
	} else {
		cm.rooms[roomID] = newParticipants
	}

	// Send leave notification
	if username != "" {
		leaveMsg := ChatMessage{
			Type:      "leave",
			Text:      username + " left the chat",
			From:      "system",
			Timestamp: time.Now(),
			RoomID:    roomID,
		}
		cm.broadcastToRoom(roomID, leaveMsg, nil)
		log.Printf("[Chat] %s left room %s", username, roomID)
	}
}

// BroadcastMessage sends a message to all participants in a room
func (cm *ChatManager) BroadcastMessage(roomID string, message ChatMessage) {
	cm.mutex.RLock()         // Read lock (multiple readers allowed)
	defer cm.mutex.RUnlock() // Unlock when done

	cm.broadcastToRoom(roomID, message, nil)
}

// broadcastToRoom is the internal function that actually sends messages
func (cm *ChatManager) broadcastToRoom(roomID string, message ChatMessage, excludeConn *websocket.Conn) {
	participants, exists := cm.rooms[roomID]
	if !exists {
		return // Room doesn't exist
	}

	// Convert message to JSON
	messageJSON, err := json.Marshal(message)
	if err != nil {
		log.Printf("[Chat] Error marshaling message: %v", err)
		return
	}

	// Send to all participants except the excluded one
	for _, participant := range participants {
		if participant.Conn == excludeConn {
			continue // Skip excluded connection
		}

		err := participant.Conn.WriteMessage(websocket.TextMessage, messageJSON)
		if err != nil {
			log.Printf("[Chat] Error sending message to %s: %v", participant.Username, err)
			// Remove disconnected participant
			go cm.RemoveParticipant(roomID, participant.ID)
		}
	}
}

// GetRoomParticipants returns list of usernames in a room
func (cm *ChatManager) GetRoomParticipants(roomID string) []string {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	participants, exists := cm.rooms[roomID]
	if !exists {
		return []string{} // Empty room
	}

	// Extract usernames
	usernames := make([]string, len(participants))
	for i, p := range participants {
		usernames[i] = p.Username
	}

	return usernames
}

// GetRoomStats returns chat statistics for monitoring
func (cm *ChatManager) GetRoomStats() map[string]interface{} {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()

	totalRooms := len(cm.rooms)
	totalParticipants := 0

	// Count all participants across all rooms
	for _, participants := range cm.rooms {
		totalParticipants += len(participants)
	}

	return map[string]interface{}{
		"totalChatRooms":        totalRooms,
		"totalChatParticipants": totalParticipants,
	}
}
