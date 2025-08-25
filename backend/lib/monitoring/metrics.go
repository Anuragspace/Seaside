package monitoring

import (
	"sync"
	"time"
)

// MetricsCollector collects and stores application metrics
type MetricsCollector struct {
	mutex sync.RWMutex
	
	// Connection metrics
	ActiveConnections    int64
	TotalConnections     int64
	ConnectionsPerSecond float64
	
	// Room metrics
	ActiveRooms          int64
	TotalRoomsCreated    int64
	AverageRoomDuration  time.Duration
	
	// Database metrics
	DatabaseConnections  int64
	QueryLatency        time.Duration
	FailedQueries       int64
	
	// Performance metrics
	RequestsPerSecond   float64
	AverageResponseTime time.Duration
	ErrorRate          float64
	
	// WebRTC metrics
	ActiveWebRTCStreams int64
	DataTransferred     int64
	
	// Timestamps
	LastUpdated         time.Time
	StartTime          time.Time
}

var GlobalMetrics = &MetricsCollector{
	StartTime: time.Now(),
}

func (m *MetricsCollector) IncrementConnections() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.ActiveConnections++
	m.TotalConnections++
	m.LastUpdated = time.Now()
}

func (m *MetricsCollector) DecrementConnections() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.ActiveConnections > 0 {
		m.ActiveConnections--
	}
	m.LastUpdated = time.Now()
}

func (m *MetricsCollector) IncrementRooms() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.ActiveRooms++
	m.TotalRoomsCreated++
	m.LastUpdated = time.Now()
}

func (m *MetricsCollector) DecrementRooms() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.ActiveRooms > 0 {
		m.ActiveRooms--
	}
	m.LastUpdated = time.Now()
}

func (m *MetricsCollector) RecordQueryLatency(duration time.Duration) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.QueryLatency = duration
	m.LastUpdated = time.Now()
}

func (m *MetricsCollector) IncrementFailedQueries() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.FailedQueries++
	m.LastUpdated = time.Now()
}

func (m *MetricsCollector) GetSnapshot() map[string]interface{} {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	
	uptime := time.Since(m.StartTime)
	
	return map[string]interface{}{
		"uptime_seconds":        uptime.Seconds(),
		"active_connections":    m.ActiveConnections,
		"total_connections":     m.TotalConnections,
		"connections_per_second": m.ConnectionsPerSecond,
		"active_rooms":          m.ActiveRooms,
		"total_rooms_created":   m.TotalRoomsCreated,
		"average_room_duration": m.AverageRoomDuration.Seconds(),
		"database_connections":  m.DatabaseConnections,
		"query_latency_ms":      m.QueryLatency.Milliseconds(),
		"failed_queries":        m.FailedQueries,
		"requests_per_second":   m.RequestsPerSecond,
		"avg_response_time_ms":  m.AverageResponseTime.Milliseconds(),
		"error_rate":           m.ErrorRate,
		"active_webrtc_streams": m.ActiveWebRTCStreams,
		"data_transferred_mb":   float64(m.DataTransferred) / (1024 * 1024),
		"last_updated":         m.LastUpdated.Unix(),
	}
}