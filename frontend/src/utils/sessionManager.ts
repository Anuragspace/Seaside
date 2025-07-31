// Session storage keys
const SESSION_ID_KEY = 'auth_session_id';
const SESSION_START_KEY = 'auth_session_start';
const SESSION_LAST_ACTIVITY_KEY = 'auth_session_last_activity';
const SESSION_TIMEOUT_KEY = 'auth_session_timeout';
const SESSION_TABS_KEY = 'auth_session_tabs';

// Session configuration
const DEFAULT_SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute
const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes (increased from 30 minutes)
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Session event types
export type SessionEventType = 
  | 'session_started'
  | 'session_renewed'
  | 'session_expired'
  | 'session_timeout'
  | 'session_cleanup'
  | 'tab_opened'
  | 'tab_closed'
  | 'activity_detected';

// Session event interface
export interface SessionEvent {
  type: SessionEventType;
  timestamp: number;
  sessionId: string;
  tabId: string;
  data?: any;
}

// Session info interface
export interface SessionInfo {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  timeout: number;
  activeTabs: string[];
  isActive: boolean;
  timeRemaining: number;
}

// Session event listener type
export type SessionEventListener = (event: SessionEvent) => void;

// Session manager class
export class SessionManager {
  private static instance: SessionManager | null = null;
  private sessionId: string | null = null;
  private tabId: string;
  private activityTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<SessionEventType, Set<SessionEventListener>> = new Map();
  private isInitialized = false;

  private constructor() {
    this.tabId = this.generateTabId();
    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SessionManager {
    if (!this.instance) {
      this.instance = new SessionManager();
    }
    return this.instance;
  }

  /**
   * Initialize session management
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    this.registerTab();
    this.startActivityMonitoring();
    this.startCleanupMonitoring();
    
    // Listen for storage changes from other tabs
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Listen for beforeunload to cleanup tab
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  /**
   * Start a new session
   */
  startSession(timeout: number = DEFAULT_SESSION_TIMEOUT): string {
    this.sessionId = this.generateSessionId();
    const now = Date.now();

    try {
      // Store session data
      localStorage.setItem(SESSION_ID_KEY, this.sessionId);
      localStorage.setItem(SESSION_START_KEY, now.toString());
      localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now.toString());
      localStorage.setItem(SESSION_TIMEOUT_KEY, timeout.toString());

      // Initialize tabs array
      const tabs = [this.tabId];
      localStorage.setItem(SESSION_TABS_KEY, JSON.stringify(tabs));
    } catch (error) {
      console.error('Error starting session:', error);
      throw new Error('Failed to start session');
    }

    // Emit session started event
    this.emitEvent('session_started', { timeout });

    return this.sessionId;
  }

  /**
   * Renew current session
   */
  renewSession(timeout?: number): void {
    if (!this.sessionId) {
      throw new Error('No active session to renew');
    }

    const now = Date.now();
    try {
      localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now.toString());

      if (timeout) {
        localStorage.setItem(SESSION_TIMEOUT_KEY, timeout.toString());
      }
    } catch (error) {
      console.error('Error renewing session:', error);
    }

    this.emitEvent('session_renewed', { timeout });
  }

  /**
   * End current session
   */
  endSession(): void {
    if (!this.sessionId) {
      return;
    }

    // Remove tab from active tabs
    this.unregisterTab();

    // Clear session data if this is the last tab
    const activeTabs = this.getActiveTabs();
    if (activeTabs.length === 0) {
      this.clearSessionData();
      this.emitEvent('session_cleanup');
    }

    this.sessionId = null;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    if (!this.sessionId) {
      return false;
    }

    try {
      const sessionId = localStorage.getItem(SESSION_ID_KEY);
      if (sessionId !== this.sessionId) {
        return false;
      }

      return !this.isSessionExpired() && !this.isSessionTimedOut();
    } catch (error) {
      console.error('Error checking session active:', error);
      return false;
    }
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(): boolean {
    const startTime = this.getSessionStartTime();
    const timeout = this.getSessionTimeout();
    
    if (!startTime || !timeout) {
      return true;
    }

    return Date.now() > (startTime + timeout);
  }

  /**
   * Check if session timed out due to inactivity
   */
  isSessionTimedOut(): boolean {
    const lastActivity = this.getLastActivity();
    
    if (!lastActivity) {
      return true;
    }

    return Date.now() > (lastActivity + INACTIVITY_TIMEOUT);
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    if (!this.sessionId) {
      return;
    }

    try {
      const now = Date.now();
      localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, now.toString());
      this.emitEvent('activity_detected');
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }

  /**
   * Get session information
   */
  getSessionInfo(): SessionInfo | null {
    if (!this.sessionId) {
      return null;
    }

    const startTime = this.getSessionStartTime();
    const lastActivity = this.getLastActivity();
    const timeout = this.getSessionTimeout();
    const activeTabs = this.getActiveTabs();

    if (!startTime || !lastActivity || !timeout) {
      return null;
    }

    const timeRemaining = Math.max(0, (startTime + timeout) - Date.now());
    const isActive = this.isSessionActive();

    return {
      sessionId: this.sessionId,
      startTime,
      lastActivity,
      timeout,
      activeTabs,
      isActive,
      timeRemaining,
    };
  }

  /**
   * Get active tabs for current session
   */
  getActiveTabs(): string[] {
    try {
      const tabsData = localStorage.getItem(SESSION_TABS_KEY);
      return tabsData ? JSON.parse(tabsData) : [];
    } catch {
      return [];
    }
  }

  /**
   * Register current tab as active
   */
  private registerTab(): void {
    try {
      const activeTabs = this.getActiveTabs();
      
      if (!activeTabs.includes(this.tabId)) {
        activeTabs.push(this.tabId);
        localStorage.setItem(SESSION_TABS_KEY, JSON.stringify(activeTabs));
        this.emitEvent('tab_opened');
      }
    } catch (error) {
      console.error('Error registering tab:', error);
    }
  }

  /**
   * Unregister current tab
   */
  private unregisterTab(): void {
    try {
      const activeTabs = this.getActiveTabs();
      const updatedTabs = activeTabs.filter(id => id !== this.tabId);
      
      if (updatedTabs.length > 0) {
        localStorage.setItem(SESSION_TABS_KEY, JSON.stringify(updatedTabs));
      } else {
        localStorage.removeItem(SESSION_TABS_KEY);
      }
      
      this.emitEvent('tab_closed');
    } catch (error) {
      console.error('Error unregistering tab:', error);
    }
  }

  /**
   * Clear all session data
   */
  private clearSessionData(): void {
    try {
      localStorage.removeItem(SESSION_ID_KEY);
      localStorage.removeItem(SESSION_START_KEY);
      localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
      localStorage.removeItem(SESSION_TIMEOUT_KEY);
      localStorage.removeItem(SESSION_TABS_KEY);
    } catch (error) {
      console.error('Error clearing session data:', error);
    }
  }

  /**
   * Start monitoring user activity
   */
  private startActivityMonitoring(): void {
    // Track user interactions
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      this.updateActivity();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Periodic activity check
    this.activityTimer = setInterval(() => {
      if (this.isSessionTimedOut()) {
        this.handleSessionTimeout();
      } else if (this.isSessionExpired()) {
        this.handleSessionExpiry();
      }
    }, ACTIVITY_CHECK_INTERVAL);
  }

  /**
   * Start cleanup monitoring
   */
  private startCleanupMonitoring(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveTabs();
    }, SESSION_CLEANUP_INTERVAL);
  }

  /**
   * Cleanup inactive tabs
   */
  private cleanupInactiveTabs(): void {
    const activeTabs = this.getActiveTabs();
    const currentTime = Date.now();
    
    // In a real implementation, you might want to ping tabs to check if they're still active
    // For now, we'll assume tabs are active if they're in the list
    
    // Clean up if session is expired
    if (this.isSessionExpired() || this.isSessionTimedOut()) {
      this.clearSessionData();
      this.emitEvent('session_cleanup');
    }
  }

  /**
   * Handle session timeout
   */
  private handleSessionTimeout(): void {
    this.emitEvent('session_timeout');
    this.endSession();
  }

  /**
   * Handle session expiry
   */
  private handleSessionExpiry(): void {
    this.emitEvent('session_expired');
    this.endSession();
  }

  /**
   * Handle storage changes from other tabs
   */
  private handleStorageChange(event: StorageEvent): void {
    if (event.key === SESSION_ID_KEY) {
      if (!event.newValue) {
        // Session ended in another tab
        this.sessionId = null;
      } else if (event.newValue !== this.sessionId) {
        // New session started in another tab
        this.sessionId = event.newValue;
        this.registerTab();
      }
    }
  }

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(): void {
    if (!document.hidden) {
      this.updateActivity();
    }
  }

  /**
   * Handle before unload
   */
  private handleBeforeUnload(): void {
    this.unregisterTab();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Initialize event listener maps
    const eventTypes: SessionEventType[] = [
      'session_started',
      'session_renewed',
      'session_expired',
      'session_timeout',
      'session_cleanup',
      'tab_opened',
      'tab_closed',
      'activity_detected'
    ];

    eventTypes.forEach(type => {
      this.eventListeners.set(type, new Set());
    });
  }

  /**
   * Add event listener
   */
  addEventListener(type: SessionEventType, listener: SessionEventListener): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: SessionEventType, listener: SessionEventListener): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit session event
   */
  private emitEvent(type: SessionEventType, data?: any): void {
    const event: SessionEvent = {
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId || '',
      tabId: this.tabId,
      data,
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Session event listener error:', error);
        }
      });
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique tab ID
   */
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session start time
   */
  private getSessionStartTime(): number | null {
    const startTime = localStorage.getItem(SESSION_START_KEY);
    return startTime ? parseInt(startTime, 10) : null;
  }

  /**
   * Get last activity time
   */
  private getLastActivity(): number | null {
    const lastActivity = localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
    return lastActivity ? parseInt(lastActivity, 10) : null;
  }

  /**
   * Get session timeout
   */
  private getSessionTimeout(): number | null {
    const timeout = localStorage.getItem(SESSION_TIMEOUT_KEY);
    return timeout ? parseInt(timeout, 10) : null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.unregisterTab();
    this.eventListeners.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();

// Export utility functions
export const {
  initialize: initializeSessionManager,
  startSession,
  renewSession,
  endSession,
  isSessionActive,
  isSessionExpired,
  isSessionTimedOut,
  updateActivity,
  getSessionInfo,
  getActiveTabs,
  addEventListener: addSessionEventListener,
  removeEventListener: removeSessionEventListener,
} = sessionManager;