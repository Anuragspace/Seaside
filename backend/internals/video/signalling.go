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

type Client struct {
	Conn  *websocket.Conn
	Mutex sync.Mutex
}

var (
	broadcast     = make(chan BroadcastMessage)
	broadcastOnce sync.Once
)

func broadcaster() {
	for msg := range broadcast {
		clients := AllRooms.Get(msg.RoomID)
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
				log.Printf("Broadcast error: %v. Closing connection.", err)
				client.Conn.Close()
				AllRooms.RemoveClient(msg.RoomID, client.Conn)
			}
		}
	}
}

func CreateRoomRequestHandler(c *fiber.Ctx) error {
	c.Set("Access-Control-Allow-Origin", "*")

	// Prevent duplicate room creation by checking if request is a fetch preflight (OPTIONS)
	if c.Method() == fiber.MethodOptions {
		return c.SendStatus(fiber.StatusNoContent)
	}

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

	participants := AllRooms.Get(roomID)
	if participants == nil {
		log.Printf("Room %s does not exist", roomID)
		c.Close()
		return
	}

	// Add new participant to the room
	AllRooms.InsertInRoom(roomID, false, c)

	// Notify ONLY the new participant if there are already others (this is the polite peer)
	if len(participants) > 0 {
		c.WriteJSON(map[string]interface{}{
			"join": true,
		})
	}

	// Start broadcaster once
	broadcastOnce.Do(func() {
		go broadcaster()
	})

	// Set up ping/pong for connection health monitoring
	c.SetPongHandler(func(string) error {
		log.Printf("Received pong from room %s", roomID)
		return nil
	})

	// Start heartbeat for this connection
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	// Channel to signal when to stop heartbeat
	done := make(chan bool)

	// Heartbeat goroutine
	go func() {
		for {
			select {
			case <-heartbeatTicker.C:
				if err := c.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
					log.Printf("Heartbeat failed for room %s: %v", roomID, err)
					done <- true
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
			c.WriteJSON(map[string]interface{}{
				"type": "pong",
			})
			continue
		}

		msg.Client = c
		msg.RoomID = roomID

		// Add message validation and rate limiting here if needed
		select {
		case broadcast <- msg:
		case <-time.After(5 * time.Second):
			log.Printf("Broadcast channel full, dropping message from room %s", roomID)
		}
	}

	// Signal heartbeat to stop
	done <- true

	// Cleanup after connection closes
	AllRooms.RemoveClient(roomID, c)

	// Notify others that a participant left
	participants = AllRooms.Get(roomID)
	for i := 0; i < len(participants); i++ {
		participant := &participants[i]
		participant.Mutex.Lock()
		_ = participant.Conn.WriteJSON(map[string]interface{}{
			"leave": true,
		})
		participant.Mutex.Unlock()
	}
	c.Close()
}