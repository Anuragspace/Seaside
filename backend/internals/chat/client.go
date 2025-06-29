package chat

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

// ChatClient represents a single user's chat connection
type ChatClient struct {
	ID       string          // Unique client ID
	Username string          // User's display name
	RoomID   string          // Which room they're in
	Conn     *websocket.Conn // Their WebSocket connection
	Manager  *ChatManager    // Reference to the chat manager
}

// NewChatClient creates a new chat client for a user
func NewChatClient(username, roomID string, conn *websocket.Conn, manager *ChatManager) *ChatClient {
	return &ChatClient{
		ID:       uuid.New().String(), // Generate unique ID
		Username: username,
		RoomID:   roomID,
		Conn:     conn,
		Manager:  manager,
	}
}

// HandleConnection is the main function that manages a user's chat session
func (cc *ChatClient) HandleConnection() {
	defer cc.cleanup() // Always clean up when function exits

	// Step 1: Add this user to the room
	cc.Manager.AddParticipant(cc.RoomID, cc.ID, cc.Username, cc.Conn)

	// Step 2: Send welcome message to this user
	welcomeMsg := ChatMessage{
		Type:      "system",
		Text:      "Welcome to the chat! You can now send messages.",
		From:      "system",
		Timestamp: time.Now(),
		RoomID:    cc.RoomID,
	}
	cc.sendMessage(welcomeMsg)

	// Step 3: Send current participants list to this user
	participants := cc.Manager.GetRoomParticipants(cc.RoomID)
	participantsMsg := ChatMessage{
		Type:      "participants",
		Text:      "Current participants: " + joinParticipants(participants),
		From:      "system",
		Timestamp: time.Now(),
		RoomID:    cc.RoomID,
	}
	cc.sendMessage(participantsMsg)

	// Step 4: Main message handling loop
	for {
		_, message, err := cc.Conn.ReadMessage()
		if err != nil {
			log.Printf("[Chat] Error reading message from %s: %v", cc.Username, err)
			break // Exit loop on error (user disconnected)
		}

		cc.handleIncomingMessage(message)
	}
}

// handleIncomingMessage processes messages from the user
func (cc *ChatClient) handleIncomingMessage(message []byte) {
	var msgData map[string]interface{}
	if err := json.Unmarshal(message, &msgData); err != nil {
		log.Printf("[Chat] Error unmarshaling message: %v", err)
		return
	}

	// Check what type of message this is
	msgType, ok := msgData["type"].(string)
	if !ok {
		log.Printf("[Chat] Invalid message type from %s", cc.Username)
		return
	}

	// Route to appropriate handler based on message type
	switch msgType {
	case "chat":
		cc.handleChatMessage(msgData)
	case "typing":
		cc.handleTypingMessage(msgData)
	case "ping":
		cc.handlePingMessage()
	default:
		log.Printf("[Chat] Unknown message type: %s from %s", msgType, cc.Username)
	}
}

// handleChatMessage processes actual chat messages
func (cc *ChatClient) handleChatMessage(msgData map[string]interface{}) {
	text, ok := msgData["text"].(string)
	if !ok || text == "" {
		return // Invalid or empty message
	}

	// Create a proper chat message
	chatMsg := ChatMessage{
		Type:      "chat",
		Text:      text,
		From:      cc.Username,
		Timestamp: time.Now(),
		RoomID:    cc.RoomID,
	}

	// Broadcast to everyone in the room
	cc.Manager.BroadcastMessage(cc.RoomID, chatMsg)

	log.Printf("[Chat] %s: %s", cc.Username, text)
}

// handleTypingMessage processes typing indicators
func (cc *ChatClient) handleTypingMessage(msgData map[string]interface{}) {
	isTyping, ok := msgData["isTyping"].(bool)
	if !ok {
		return
	}

	// Create typing message
	typingMsg := ChatMessage{
		Type:      "typing",
		Text:      "",
		From:      cc.Username,
		Timestamp: time.Now(),
		RoomID:    cc.RoomID,
	}

	if isTyping {
		typingMsg.Text = cc.Username + " is typing..."
	}

	// Send typing indicator to other participants (not to sender)
	cc.Manager.broadcastToRoom(cc.RoomID, typingMsg, cc.Conn)
}

// handlePingMessage handles ping messages for connection health
func (cc *ChatClient) handlePingMessage() {
	pongMsg := ChatMessage{
		Type:      "pong",
		Text:      "",
		From:      "system",
		Timestamp: time.Now(),
		RoomID:    cc.RoomID,
	}
	cc.sendMessage(pongMsg)
}

// sendMessage sends a message to this specific client
func (cc *ChatClient) sendMessage(message ChatMessage) {
	messageJSON, err := json.Marshal(message)
	if err != nil {
		log.Printf("[Chat] Error marshaling message: %v", err)
		return
	}

	err = cc.Conn.WriteMessage(websocket.TextMessage, messageJSON)
	if err != nil {
		log.Printf("[Chat] Error sending message to %s: %v", cc.Username, err)
	}
}

// cleanup removes the client from the room and closes connection
func (cc *ChatClient) cleanup() {
	cc.Manager.RemoveParticipant(cc.RoomID, cc.ID)
	cc.Conn.Close()
	log.Printf("[Chat] Client %s disconnected from room %s", cc.Username, cc.RoomID)
}

// joinParticipants creates a comma-separated list of participant names
func joinParticipants(participants []string) string {
	if len(participants) == 0 {
		return "None"
	}

	result := ""
	for i, participant := range participants {
		if i > 0 {
			result += ", "
		}
		result += participant
	}
	return result
}
