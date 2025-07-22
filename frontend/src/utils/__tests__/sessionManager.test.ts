import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { SessionManager, sessionManager, SessionEvent } from '../sessionManager';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock window events
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(window, 'addEventListener', {
    value: mockAddEventListener,
});
Object.defineProperty(window, 'removeEventListener', {
    value: mockRemoveEventListener,
});

// Mock document events
const mockDocumentAddEventListener = vi.fn();
const mockDocumentRemoveEventListener = vi.fn();
Object.defineProperty(document, 'addEventListener', {
    value: mockDocumentAddEventListener,
});
Object.defineProperty(document, 'removeEventListener', {
    value: mockDocumentRemoveEventListener,
});

// Mock timers
vi.useFakeTimers();

describe('SessionManager', () => {
    let manager: SessionManager;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        manager = SessionManager.getInstance();
    });

    afterEach(() => {
        manager.destroy();
        vi.clearAllTimers();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = SessionManager.getInstance();
            const instance2 = SessionManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should return the same instance as the exported sessionManager', () => {
            const instance = SessionManager.getInstance();
            expect(instance).toBe(sessionManager);
        });
    });

    describe('Session Lifecycle', () => {
        it('should start a new session', () => {
            const sessionId = manager.startSession();

            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe('string');
            expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);

            expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_session_id', sessionId);
            expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_session_start', expect.any(String));
            expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_session_last_activity', expect.any(String));
            expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_session_timeout', expect.any(String));
        });

        it('should start session with custom timeout', () => {
            const customTimeout = 60 * 60 * 1000; // 1 hour
            manager.startSession(customTimeout);

            expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_session_timeout', customTimeout.toString());
        });

        it('should renew existing session', () => {
            const sessionId = manager.startSession();
            const initialTime = Date.now();

            vi.advanceTimersByTime(5000); // Advance 5 seconds

            manager.renewSession();

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'auth_session_last_activity',
                expect.stringMatching(/^\d+$/)
            );
        });

        it('should throw error when renewing non-existent session', () => {
            // Ensure no session is active
            manager.endSession();

            expect(() => manager.renewSession()).toThrow('No active session to renew');
        });

        it('should end session', () => {
            manager.startSession();
            manager.endSession();

            // Should clear session data when no other tabs
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_session_id');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_session_start');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_session_last_activity');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_session_timeout');
        });
    });

    describe('Session State Checks', () => {
        it('should return false for active session when no session exists', () => {
            expect(manager.isSessionActive()).toBe(false);
        });

        it('should return true for active session when session is valid', () => {
            const sessionId = manager.startSession();

            // Mock localStorage to return session data
            localStorageMock.getItem.mockImplementation((key) => {
                switch (key) {
                    case 'auth_session_id':
                        return sessionId;
                    case 'auth_session_start':
                        return Date.now().toString();
                    case 'auth_session_last_activity':
                        return Date.now().toString();
                    case 'auth_session_timeout':
                        return (24 * 60 * 60 * 1000).toString(); // 24 hours
                    default:
                        return null;
                }
            });

            expect(manager.isSessionActive()).toBe(true);
        });

        it('should detect expired session', () => {
            const sessionId = manager.startSession();
            const pastTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

            localStorageMock.getItem.mockImplementation((key) => {
                switch (key) {
                    case 'auth_session_id':
                        return sessionId;
                    case 'auth_session_start':
                        return pastTime.toString();
                    case 'auth_session_last_activity':
                        return pastTime.toString();
                    case 'auth_session_timeout':
                        return (24 * 60 * 60 * 1000).toString(); // 24 hours
                    default:
                        return null;
                }
            });

            expect(manager.isSessionExpired()).toBe(true);
            expect(manager.isSessionActive()).toBe(false);
        });

        it('should detect timed out session due to inactivity', () => {
            const sessionId = manager.startSession();
            const inactiveTime = Date.now() - (31 * 60 * 1000); // 31 minutes ago

            localStorageMock.getItem.mockImplementation((key) => {
                switch (key) {
                    case 'auth_session_id':
                        return sessionId;
                    case 'auth_session_start':
                        return Date.now().toString();
                    case 'auth_session_last_activity':
                        return inactiveTime.toString();
                    case 'auth_session_timeout':
                        return (24 * 60 * 60 * 1000).toString(); // 24 hours
                    default:
                        return null;
                }
            });

            expect(manager.isSessionTimedOut()).toBe(true);
            expect(manager.isSessionActive()).toBe(false);
        });
    });

    describe('Activity Tracking', () => {
        it('should update activity timestamp', () => {
            const sessionId = manager.startSession();

            vi.advanceTimersByTime(5000);
            manager.updateActivity();

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'auth_session_last_activity',
                expect.stringMatching(/^\d+$/)
            );
        });

        it('should not update activity when no session exists', () => {
            // Ensure no session is active
            manager.endSession();

            // Clear any previous calls
            localStorageMock.setItem.mockClear();

            manager.updateActivity();

            expect(localStorageMock.setItem).not.toHaveBeenCalled();
        });
    });

    describe('Session Information', () => {
        it('should return null when no session exists', () => {
            const info = manager.getSessionInfo();
            expect(info).toBeNull();
        });

        it('should return session information when session exists', () => {
            const sessionId = manager.startSession();
            const now = Date.now();
            const timeout = 24 * 60 * 60 * 1000; // 24 hours

            localStorageMock.getItem.mockImplementation((key) => {
                switch (key) {
                    case 'auth_session_id':
                        return sessionId;
                    case 'auth_session_start':
                        return now.toString();
                    case 'auth_session_last_activity':
                        return now.toString();
                    case 'auth_session_timeout':
                        return timeout.toString();
                    case 'auth_session_tabs':
                        return JSON.stringify(['tab1', 'tab2']);
                    default:
                        return null;
                }
            });

            const info = manager.getSessionInfo();

            expect(info).toEqual({
                sessionId,
                startTime: now,
                lastActivity: now,
                timeout,
                activeTabs: ['tab1', 'tab2'],
                isActive: true,
                timeRemaining: expect.any(Number),
            });
        });
    });

    describe('Tab Management', () => {
        it('should return empty array when no tabs data exists', () => {
            const tabs = manager.getActiveTabs();
            expect(tabs).toEqual([]);
        });

        it('should return active tabs when data exists', () => {
            const mockTabs = ['tab1', 'tab2', 'tab3'];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTabs));

            const tabs = manager.getActiveTabs();
            expect(tabs).toEqual(mockTabs);
        });

        it('should handle invalid JSON in tabs data', () => {
            localStorageMock.getItem.mockReturnValue('invalid-json');

            const tabs = manager.getActiveTabs();
            expect(tabs).toEqual([]);
        });
    });

    describe('Event System', () => {
        it('should add event listeners', () => {
            const listener = vi.fn();

            expect(() => {
                manager.addEventListener('session_started', listener);
            }).not.toThrow();
        });

        it('should remove event listeners', () => {
            const listener = vi.fn();

            manager.addEventListener('session_started', listener);

            expect(() => {
                manager.removeEventListener('session_started', listener);
            }).not.toThrow();
        });
    });

    describe('Initialization', () => {
        it('should initialize session manager', () => {
            manager.initialize();

            // Should set up event listeners
            expect(mockAddEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
            expect(mockAddEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
            expect(mockDocumentAddEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        });

        it('should not initialize multiple times', () => {
            manager.initialize();
            const callCount = mockAddEventListener.mock.calls.length;

            manager.initialize();
            expect(mockAddEventListener.mock.calls.length).toBe(callCount);
        });
    });

    describe('Cleanup', () => {
        it('should cleanup resources on destroy', () => {
            manager.initialize();
            manager.startSession();

            manager.destroy();

            // Should clear timers and event listeners
            expect(manager['isInitialized']).toBe(false);
        });
    });

    describe('Security Features', () => {
        it('should generate unique session IDs', () => {
            const sessionId1 = manager.startSession();
            manager.endSession();

            const sessionId2 = manager.startSession();
            manager.endSession();

            expect(sessionId1).not.toBe(sessionId2);
            expect(sessionId1).toMatch(/^session_\d+_[a-z0-9]+$/);
            expect(sessionId2).toMatch(/^session_\d+_[a-z0-9]+$/);
        });

        it('should handle storage errors gracefully', () => {
            localStorageMock.setItem.mockImplementation(() => {
                throw new Error('Storage error');
            });

            // Should throw error for startSession since it's critical
            expect(() => manager.startSession()).toThrow('Failed to start session');
        });

        it('should handle localStorage access errors', () => {
            localStorageMock.getItem.mockImplementation(() => {
                throw new Error('Storage access error');
            });

            expect(manager.getActiveTabs()).toEqual([]);
            expect(manager.isSessionActive()).toBe(false);
        });
    });

    describe('Multi-tab Synchronization', () => {
        it('should handle storage events from other tabs', () => {
            // Reset localStorage mock to not throw errors
            localStorageMock.setItem.mockImplementation(() => { });

            manager.initialize();
            const storageHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'storage'
            )?.[1];

            expect(storageHandler).toBeDefined();

            // Simulate session end in another tab
            const storageEvent = new StorageEvent('storage', {
                key: 'auth_session_id',
                newValue: null,
                oldValue: 'old-session-id',
            });

            expect(() => storageHandler(storageEvent)).not.toThrow();
        });

        it('should handle visibility changes', () => {
            // Reset localStorage mock to not throw errors
            localStorageMock.setItem.mockImplementation(() => { });

            manager.initialize();
            manager.startSession();

            const visibilityHandler = mockDocumentAddEventListener.mock.calls.find(
                call => call[0] === 'visibilitychange'
            )?.[1];

            expect(visibilityHandler).toBeDefined();

            // Mock document.hidden
            Object.defineProperty(document, 'hidden', {
                value: false,
                configurable: true,
            });

            expect(() => visibilityHandler()).not.toThrow();
        });
    });
});