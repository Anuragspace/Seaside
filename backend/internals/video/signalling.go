package video

import (
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

var AllRooms RoomMap

type response struct {
	RoomID string `json:"roomID"`
}

type BroadcastMessage struct {
	Message map[string]interface{}
	RoomID  string
	Client  *websocket.Conn
}

// This is unused in current code but kept for compatibility
type Client struct {
	Conn  *websocket.Conn
	Mutex sync.Mutex
}

var (
	broadcast     = make(chan BroadcastMessage, 100) // Buffered channel
	broadcastOnce sync.Once
)

func broadcaster() {
	for msg := range broadcast {
		clients := AllRooms.Get(msg.RoomID)
		log.Printf("Broadcasting to %d clients in room %s", len(clients), msg.RoomID)
		
		for i := 0; i < len(clients); i++ {
			client := &clients[i]
			// Don't send message back to sender
			if client.Conn == msg.Client {
				continue
			}

			client.Mutex.Lock()
			err := client.Conn.WriteJSON(msg.Message)
			client.Mutex.Unlock()

			if err != nil {
				log.Printf("Broadcast error for room %s: %v. Closing connection.", msg.RoomID, err)
				client.Conn.Close()
				AllRooms.RemoveClient(msg.RoomID, client.Conn)
			}
		}
	}
}

func CreateRoomRequestHandler(c *fiber.Ctx) error {
	roomID := AllRooms.CreateRoom()
	log.Printf("Room created: %s", roomID)
	return c.JSON(response{RoomID: roomID})
}

func WebSocketJoinHandler(c *websocket.Conn) {
	roomID := c.Query("roomID")
	if roomID == "" {
		log.Println("roomID is missing in WebSocket connection")
		c.Close()
		return
	}

	log.Printf("New WebSocket connection for room: %s", roomID)

	// Check if room exists, if not create it
	participants := AllRooms.Get(roomID)

	// Add new participant to the room
	AllRooms.InsertInRoom(roomID, false, c)

	// Get updated participants list
	participants = AllRooms.Get(roomID)

	// Notify ALL participants when someone joins
	if len(participants) > 1 {
		log.Printf("Notifying all participants in room %s that someone joined", roomID)
		
		// Notify the new participant
		err := c.WriteJSON(map[string]interface{}{
			"join": true,
		})
		if err != nil {
			log.Printf("Error notifying new participant: %v", err)
		}
		
		// Notify existing participants
		joinMsg := BroadcastMessage{
			Message: map[string]interface{}{
				"join": true,
			},
			RoomID: roomID,
			Client: c, // Exclude the new joiner from broadcast
		}
		
		select {
		case broadcast <- joinMsg:
		case <-time.After(5 * time.Second):
			log.Printf("Failed to broadcast join message for room %s", roomID)
		}
	}

	// Set up ping/pong for connection health monitoring
	c.SetPongHandler(func(string) error {
		log.Printf("Received pong from room %s", roomID)
		AllRooms.UpdateLastPing(roomID, c)
		return nil
	})

	// Start broadcaster once
	broadcastOnce.Do(func() {
		go broadcaster()
	})

	// Start heartbeat for this connection
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	// Channel to signal when to stop heartbeat
	done := make(chan bool, 1)

	// Heartbeat goroutine
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Heartbeat goroutine panic for room %s: %v", roomID, r)
			}
		}()

		for {
			select {
			case <-heartbeatTicker.C:
				if err := c.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
					log.Printf("Heartbeat failed for room %s: %v", roomID, err)
					select {
					case done <- true:
					default:
					}
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Listen for messages from this participant
	for {
		var msg BroadcastMessage
		err := c.ReadJSON(&msg.Message)
		if err != nil {
			log.Printf("Read error in room %s: %v", roomID, err)
			break
		}

		// Handle ping messages from client
		if msgType, ok := msg.Message["type"].(string); ok && msgType == "ping" {
			// Send pong response
			err := c.WriteJSON(map[string]interface{}{
				"type": "pong",
			})
			if err != nil {
				log.Printf("Error sending pong to room %s: %v", roomID, err)
			}
			AllRooms.UpdateLastPing(roomID, c)
			continue
		}

		msg.Client = c
		msg.RoomID = roomID

		// Log the message type for debugging
		if _, hasOffer := msg.Message["offer"]; hasOffer {
			log.Printf("Broadcasting offer in room %s", roomID)
		} else if _, hasAnswer := msg.Message["answer"]; hasAnswer {
			log.Printf("Broadcasting answer in room %s", roomID)
		} else if _, hasCandidate := msg.Message["iceCandidate"]; hasCandidate {
			log.Printf("Broadcasting ICE candidate in room %s", roomID)
		}

		// Broadcast message with timeout to prevent blocking
		select {
		case broadcast <- msg:
		case <-time.After(5 * time.Second):
			log.Printf("Broadcast channel full, dropping message from room %s", roomID)
		}
	}

	// Signal heartbeat to stop
	select {
	case done <- true:
	default:
	}

	// Cleanup after connection closes
	log.Printf("Cleaning up connection for room %s", roomID)
	AllRooms.RemoveClient(roomID, c)

	// Notify others that a participant left
	participants = AllRooms.Get(roomID)
	for i := 0; i < len(participants); i++ {
		participant := &participants[i]
		participant.Mutex.Lock()
		err := participant.Conn.WriteJSON(map[string]interface{}{
			"leave": true,
		})
		participant.Mutex.Unlock()
		if err != nil {
			log.Printf("Error notifying participant of leave in room %s: %v", roomID, err)
		}
	}

	c.Close()
}
