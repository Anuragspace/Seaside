package chat

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type chatClient struct {
	Id       string
	Username string
	RoomId   string
	Conn     *websocket.Conn
	Manager  *ChatManager
}

func NewChatClient(username, roomID string, conn *websocket.Conn, manager *ChatManager) *chatClient {
	return &chatClient{
		Id:       uuid.New().String(),
		Username: username,
		RoomId:   roomID,
		Conn:     conn,
		Manager:  manager,
	}
}

func (cc *chatClient) HandleConnection() {
	defer cc.cleanup()

	//adding user to the room
	cc.Manager.AddParticipant(cc.RoomId, cc.Id, cc.Username, cc.Conn)

	//sending the welcome message
	welcomeMsg := ChatMessage{
		Type:      "system",
		Text:      "Welcome to the chat!",
		From:      "system",
		Timestamp: time.Now(),
		RoomID:    cc.RoomId,
	}
	cc.sendMessage(welcomeMsg)

	//send the current participant list
	participants := cc.Manager.GetRoomParticipants(cc.RoomId)
	participantsMsg := ChatMessage{
		Type:      "participants",
		Text:      "Current participants: " + strings.Join(participants, ", "),
		From:      "system",
		Timestamp: time.Now(),
		RoomID:    cc.RoomId,
	}
	cc.sendMessage(participantsMsg)

	// main message handeling loop
	for {
		_, message, err := cc.Conn.ReadMessage()
		if err != nil {
			log.Printf("[Chat] Error reading message from %s: %v", cc.Username, err)
			break
		}
		cc.handleIncomingMessage(message)
	}
}

// handle the incoming messages
func (cc *chatClient) handleIncomingMessage(message []byte) {
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

	if msgType == "chat" {
		text, ok := msgData["text"].(string)
		if ok && text == "clear" {
			clearMsg := ChatMessage{
				Type:      "system",
				Text:      "Chat cleared",
				From:      "system",
				Timestamp: time.Now(),
				RoomID:    cc.RoomId,
			}
			cc.Manager.BroadcastMessage(cc.RoomId, clearMsg)
			return
		}
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

func (cc *chatClient) handleChatMessage(msgData map[string]interface{}) {
	text, ok := msgData["text"].(string)
	if !ok || text == "" {
		return
	}

	// creating a proper chat message
	chatMsg := ChatMessage{
		Type:      "chat",
		Text:      text,
		From:      cc.Username,
		Timestamp: time.Now(),
		RoomID:    cc.RoomId,
	}

	// broadcast the message to everyone (including sender)
	cc.Manager.broadcastToRoom(cc.RoomId, chatMsg, nil)

	log.Printf("[Chat] %s: %s ::: %s", cc.Username, text, time.Now())
}

// handle the typing message
func (cc *chatClient) handleTypingMessage(msgData map[string]interface{}) {
	isTyping, ok := msgData["isTyping"].(bool)
	if !ok {
		return
	}

	// the typing message
	typingMsg := ChatMessage{
		Type:      "typing",
		Text:      "",
		From:      cc.Username,
		Timestamp: time.Now(),
		RoomID:    cc.RoomId,
	}

	if isTyping {
		typingMsg.Text = cc.Username + " is hmm..."
	}

	// send the indicator to the other end
	cc.Manager.broadcastToRoom(cc.RoomId, typingMsg, cc.Conn)
}

// handles the ping messagefor the connection health
func (cc *chatClient) handlePingMessage() {
	pingMsg := ChatMessage{
		Type:      "pong",
		Text:      "",
		From:      "system",
		Timestamp: time.Now(),
		RoomID:    cc.RoomId,
	}
	cc.sendMessage(pingMsg)
}

// sendMessage sends a message to this specific client
func (cc *chatClient) sendMessage(message ChatMessage) {
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
func (cc *chatClient) cleanup() {
	cc.Manager.RemoveParticipant(cc.RoomId, cc.Id)
	cc.Conn.Close()
	log.Printf("[Chat] Client %s disconnected from room %s", cc.Username, cc.RoomId)
}
