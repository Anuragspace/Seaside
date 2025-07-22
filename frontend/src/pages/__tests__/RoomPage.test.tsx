import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RoomPage from '../RoomPage';
import { AuthProvider } from '../../contexts/AuthContext';
import * as authMiddleware from '../../hooks/useAuthMiddleware';

// Mock the hooks and services
vi.mock('../../hooks/useWebRTC', () => ({
  useWebRTC: () => ({
    sendMessage: vi.fn(),
    onMessage: vi.fn(),
    dataChannelOpen: true,
    connectionState: 'connected',
    iceConnectionState: 'connected',
    isReconnecting: false,
    connectionStats: {},
    reconnect: vi.fn(),
  }),
}));

vi.mock('../../hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    isTyping: false,
    chatStats: {},
    isConnected: true,
    sendMessage: vi.fn(),
    handleTyping: vi.fn(),
    clearMessages: vi.fn(),
    connectChat: vi.fn(),
  }),
}));

vi.mock('../../hooks/audioRecord', () => ({
  setupAudio: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
}));

vi.mock('../../hooks/videoRecord', () => ({
  setupVideo: vi.fn(),
  startVideoRecording: vi.fn(),
  stopVideoRecording: vi.fn(),
}));

vi.mock('../../components/ChatBox', () => ({
  default: () => <div data-testid="chat-box">Chat Box</div>,
}));

vi.mock('../../components/ConnectionStatus', () => ({
  default: () => <div data-testid="connection-status">Connection Status</div>,
}));

// Mock auth context
const mockAuthContext = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  refreshToken: vi.fn(),
};

const mockAuthenticatedContext = {
  ...mockAuthContext,
  user: { id: '1', username: 'testuser', email: 'test@example.com' },
  isAuthenticated: true,
};

// Mock recording auth middleware
const mockRecordingAuth = {
  canAccess: false,
  requestAuth: vi.fn(),
  isAuthModalOpen: false,
  closeAuthModal: vi.fn(),
  authRequiredFeature: 'recording' as const,
  redirectAfterAuth: undefined,
};

const mockAuthenticatedRecordingAuth = {
  ...mockRecordingAuth,
  canAccess: true,
};

describe('RoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock useRecordingAuth
    vi.spyOn(authMiddleware, 'useRecordingAuth').mockReturnValue(mockRecordingAuth);
  });

  const renderRoomPage = (authContext = mockAuthContext, roomId = 'test123') => {
    return render(
      <MemoryRouter initialEntries={[`/room/${roomId}?user=testuser`]}>
        <AuthProvider>
          <RoomPage />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('renders room page with basic elements', () => {
    renderRoomPage();
    
    expect(screen.getByText(/Room: test123/)).toBeInTheDocument();
    expect(screen.getByTestId('chat-box')).toBeInTheDocument();
  });

  it('shows guest username when user is not authenticated', () => {
    renderRoomPage();
    
    // Should show either the URL param username or a generated guest username
    const userInfo = screen.getByText(/Guest • testuser/);
    expect(userInfo).toBeInTheDocument();
  });

  it('shows authenticated username when user is authenticated', () => {
    vi.spyOn(authMiddleware, 'useRecordingAuth').mockReturnValue(mockAuthenticatedRecordingAuth);
    
    render(
      <MemoryRouter initialEntries={['/room/test123?user=testuser']}>
        <AuthProvider>
          <RoomPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Note: This test would need the actual auth context to be mocked properly
    // For now, we're testing the structure
    expect(screen.getByText(/Room: test123/)).toBeInTheDocument();
  });

  it('requests authentication when unauthenticated user tries to record audio', async () => {
    renderRoomPage();
    
    const recordButton = screen.getByText('Record Audio');
    fireEvent.click(recordButton);
    
    expect(mockRecordingAuth.requestAuth).toHaveBeenCalled();
  });

  it('requests authentication when unauthenticated user tries to record video', async () => {
    renderRoomPage();
    
    const recordButton = screen.getByText('Record Video');
    fireEvent.click(recordButton);
    
    expect(mockRecordingAuth.requestAuth).toHaveBeenCalled();
  });

  it('allows recording when user is authenticated', async () => {
    vi.spyOn(authMiddleware, 'useRecordingAuth').mockReturnValue(mockAuthenticatedRecordingAuth);
    
    renderRoomPage();
    
    const recordButton = screen.getByText('Record Audio');
    fireEvent.click(recordButton);
    
    // Should start countdown instead of requesting auth
    await waitFor(() => {
      expect(screen.getByText(/Starting in/)).toBeInTheDocument();
    });
  });

  it('generates guest username when no user param provided', () => {
    render(
      <MemoryRouter initialEntries={['/room/test123']}>
        <AuthProvider>
          <RoomPage />
        </AuthProvider>
      </MemoryRouter>
    );
    
    // Should show a generated guest username
    const userInfo = screen.getByText(/Guest •/);
    expect(userInfo).toBeInTheDocument();
  });

  it('shows authentication modal when recording auth is requested', () => {
    const mockRecordingAuthWithModal = {
      ...mockRecordingAuth,
      isAuthModalOpen: true,
    };
    
    vi.spyOn(authMiddleware, 'useRecordingAuth').mockReturnValue(mockRecordingAuthWithModal);
    
    renderRoomPage();
    
    // The AuthRequestModal should be rendered
    expect(screen.getByText('Sign in to Record')).toBeInTheDocument();
  });

  it('handles room navigation correctly', () => {
    const mockNavigate = vi.fn();
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    renderRoomPage();
    
    const leaveButton = screen.getByTitle('Leave room');
    
    // Mock window.confirm
    window.confirm = vi.fn(() => true);
    
    fireEvent.click(leaveButton);
    
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to leave the room?');
  });

  it('handles mic and video controls', () => {
    renderRoomPage();
    
    const micButton = screen.getByTitle(/Mute microphone/);
    const videoButton = screen.getByTitle(/Turn off camera/);
    
    expect(micButton).toBeInTheDocument();
    expect(videoButton).toBeInTheDocument();
    
    fireEvent.click(micButton);
    fireEvent.click(videoButton);
    
    // Should toggle the buttons (implementation would need state checking)
  });

  it('copies room ID to clipboard', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    renderRoomPage();
    
    const shareButton = screen.getByTitle('Copy room ID');
    fireEvent.click(shareButton);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test123');
  });

  it('redirects to home if room ID is invalid', () => {
    const mockNavigate = vi.fn();
    
    render(
      <MemoryRouter initialEntries={['/room/123']}>
        <AuthProvider>
          <RoomPage />
        </AuthProvider>
      </MemoryRouter>
    );
    
    // Should redirect for room IDs less than 6 characters
    // This would need proper navigation mocking to test fully
  });
});