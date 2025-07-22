package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"
)

// OAuth2StateManager manages OAuth2 state parameters for CSRF protection
type OAuth2StateManager struct {
	states map[string]*StateInfo
	mutex  sync.RWMutex
}

// StateInfo holds information about an OAuth2 state
type StateInfo struct {
	CreatedAt time.Time
	UserIP    string
	Provider  string
	ExpiresAt time.Time
}

// NewOAuth2StateManager creates a new OAuth2 state manager
func NewOAuth2StateManager() *OAuth2StateManager {
	manager := &OAuth2StateManager{
		states: make(map[string]*StateInfo),
	}
	
	// Start cleanup goroutine
	go manager.cleanupExpiredStates()
	
	return manager
}

// GenerateState generates a new OAuth2 state parameter
func (m *OAuth2StateManager) GenerateState(userIP, provider string) (string, error) {
	// Generate random bytes
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random state: %w", err)
	}
	
	// Encode to base64 URL-safe string
	state := base64.URLEncoding.EncodeToString(bytes)
	
	// Store state information
	m.mutex.Lock()
	defer m.mutex.Unlock()
	
	m.states[state] = &StateInfo{
		CreatedAt: time.Now(),
		UserIP:    userIP,
		Provider:  provider,
		ExpiresAt: time.Now().Add(10 * time.Minute), // State expires in 10 minutes
	}
	
	return state, nil
}

// ValidateState validates an OAuth2 state parameter
func (m *OAuth2StateManager) ValidateState(state, userIP, provider string) error {
	if state == "" {
		return fmt.Errorf("state parameter is required")
	}
	
	m.mutex.RLock()
	stateInfo, exists := m.states[state]
	m.mutex.RUnlock()
	
	if !exists {
		return fmt.Errorf("invalid or expired state parameter")
	}
	
	// Check if state has expired
	if time.Now().After(stateInfo.ExpiresAt) {
		m.removeState(state)
		return fmt.Errorf("state parameter has expired")
	}
	
	// Validate IP address (optional, can be disabled for mobile apps)
	if stateInfo.UserIP != userIP {
		return fmt.Errorf("state parameter IP mismatch")
	}
	
	// Validate provider
	if stateInfo.Provider != provider {
		return fmt.Errorf("state parameter provider mismatch")
	}
	
	// Remove state after successful validation (one-time use)
	m.removeState(state)
	
	return nil
}

// removeState removes a state from the manager
func (m *OAuth2StateManager) removeState(state string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	delete(m.states, state)
}

// cleanupExpiredStates periodically removes expired states
func (m *OAuth2StateManager) cleanupExpiredStates() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		m.mutex.Lock()
		now := time.Now()
		for state, info := range m.states {
			if now.After(info.ExpiresAt) {
				delete(m.states, state)
			}
		}
		m.mutex.Unlock()
	}
}

// GetStateCount returns the number of active states (for monitoring)
func (m *OAuth2StateManager) GetStateCount() int {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return len(m.states)
}

// ClearExpiredStates manually clears expired states
func (m *OAuth2StateManager) ClearExpiredStates() int {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	
	now := time.Now()
	cleared := 0
	
	for state, info := range m.states {
		if now.After(info.ExpiresAt) {
			delete(m.states, state)
			cleared++
		}
	}
	
	return cleared
}