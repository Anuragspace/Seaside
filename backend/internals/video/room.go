package video

import (
	"math/rand"
	"sync"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
)

type Participant struct {
	Host     bool
	ID       string
	Conn     *websocket.Conn
	Mutex    sync.Mutex
	JoinedAt time.Time
	LastPing time.Time
}

type RoomMap struct {
	Mutex sync.RWMutex
	Map   map[string][]Participant
}

func (r *RoomMap) Init() {
	r.Map = make(map[string][]Participant)

	// Start cleanup routine for inactive rooms
	go r.cleanupRoutine()
}

func (r *RoomMap) Get(roomID string) []Participant {
	r.Mutex.RLock()
	defer r.Mutex.RUnlock()
	return r.Map[roomID]
}

func (r *RoomMap) CreateRoom() string {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	// Use crypto/rand for better randomness in production
	rgen := rand.New(rand.NewSource(time.Now().UnixNano()))
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

	var roomID string
	for {
		b := make([]rune, 8)
		for i := range b {
			b[i] = letters[rgen.Intn(len(letters))]
		}
		roomID = string(b)

		// Ensure room ID is unique
		if _, exists := r.Map[roomID]; !exists {
			break
		}
	}

	r.Map[roomID] = []Participant{}
	return roomID
}

func (r *RoomMap) InsertInRoom(roomID string, host bool, conn *websocket.Conn) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	clientID := uuid.New().String()
	now := time.Now()
	newParticipant := Participant{
		Host:     host,
		ID:       clientID,
		Conn:     conn,
		Mutex:    sync.Mutex{},
		JoinedAt: now,
		LastPing: now,
	}

	r.Map[roomID] = append(r.Map[roomID], newParticipant)
}

// Remove a client from a room safely
func (r *RoomMap) RemoveClient(roomID string, conn *websocket.Conn) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	participants, ok := r.Map[roomID]
	if !ok {
		return
	}

	for i, participant := range participants {
		if participant.Conn == conn {
			// Remove participant from slice
			r.Map[roomID] = append(participants[:i], participants[i+1:]...)
			break
		}
	}

	// If room empty after removal, delete the room
	if len(r.Map[roomID]) == 0 {
		delete(r.Map, roomID)
	}
}

func (r *RoomMap) DeleteRoom(roomID string) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	delete(r.Map, roomID)
}

// Update last ping time for a participant
func (r *RoomMap) UpdateLastPing(roomID string, conn *websocket.Conn) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	participants, ok := r.Map[roomID]
	if !ok {
		return
	}

	for i := range participants {
		if participants[i].Conn == conn {
			participants[i].LastPing = time.Now()
			break
		}
	}
}

// Get room statistics
func (r *RoomMap) GetRoomStats() map[string]interface{} {
	r.Mutex.RLock()
	defer r.Mutex.RUnlock()

	totalRooms := len(r.Map)
	totalParticipants := 0
	activeRooms := 0

	for _, participants := range r.Map {
		totalParticipants += len(participants)
		if len(participants) > 0 {
			activeRooms++
		}
	}

	return map[string]interface{}{
		"totalRooms":        totalRooms,
		"activeRooms":       activeRooms,
		"totalParticipants": totalParticipants,
	}
}

// Cleanup routine to remove stale rooms and participants
func (r *RoomMap) cleanupRoutine() {
	ticker := time.NewTicker(5 * time.Minute) // Run every 5 minutes
	defer ticker.Stop()

	for range ticker.C {
		r.cleanup()
	}
}

func (r *RoomMap) cleanup() {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	now := time.Now()
	roomsToDelete := []string{}

	for roomID, participants := range r.Map {
		activeParticipants := []Participant{}

		for _, participant := range participants {
			// Remove participants that haven't pinged in 2 minutes
			if now.Sub(participant.LastPing) < 2*time.Minute {
				activeParticipants = append(activeParticipants, participant)
			} else {
				// Close stale connection
				participant.Conn.Close()
			}
		}

		if len(activeParticipants) == 0 {
			// Mark room for deletion if no active participants
			roomsToDelete = append(roomsToDelete, roomID)
		} else {
			r.Map[roomID] = activeParticipants
		}
	}

	// Delete empty rooms
	for _, roomID := range roomsToDelete {
		delete(r.Map, roomID)
	}
}
