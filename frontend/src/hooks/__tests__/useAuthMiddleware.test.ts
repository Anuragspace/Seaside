import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthMiddleware, authMiddlewareConfigs } from '../useAuthMiddleware';
import { useAuth } from '../../contexts/AuthContext';

// Mock the useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock window.location
const mockLocation = {
  href: '',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('useAuthMiddleware', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@example.com', username: 'testuser' },
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        refreshToken: vi.fn(),
      });
    });

    it('should allow access when authentication is required', () => {
      const { result } = renderHook(() =>
        useAuthMiddleware({ requireAuth: true, feature: 'recording' })
      );

      expect(result.current.canAccess).toBe(true);
      expect(result.current.isAuthModalOpen).toBe(false);
    });

    it('should allow access when authentication is not required', () => {
      const { result } = renderHook(() =>
        useAuthMiddleware({ requireAuth: false, feature: 'room-creation' })
      );

      expect(result.current.canAccess).toBe(true);
      expect(result.current.isAuthModalOpen).toBe(false);
    });

    it('should close auth modal when user becomes authenticated', () => {
      // Start with unauthenticated user and mock the hook to return that state
      const mockAuthState = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        refreshToken: vi.fn(),
      };

      mockUseAuth.mockReturnValue(mockAuthState);

      const { result, rerender } = renderHook(() =>
        useAuthMiddleware({ requireAuth: true, feature: 'recording' })
      );

      // Request auth to open modal
      act(() => {
        result.current.requestAuth();
      });

      expect(result.current.isAuthModalOpen).toBe(true);

      // Now update the mock to return authenticated state
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = { id: '1', email: 'test@example.com', username: 'testuser' };
      
      mockUseAuth.mockReturnValue(mockAuthState);

      rerender();

      expect(result.current.isAuthModalOpen).toBe(false);
    });

    it('should handle auto-redirect after authentication', () => {
      const redirectUrl = '/dashboard';
      
      renderHook(() =>
        useAuthMiddleware({
          requireAuth: true,
          feature: 'profile',
          autoRedirect: true,
          redirectAfterAuth: redirectUrl,
        })
      );

      expect(mockLocation.href).toBe(redirectUrl);
    });

    it('should use stored redirect URL over provided one', () => {
      const storedUrl = '/stored-redirect';
      const providedUrl = '/provided-redirect';
      
      mockSessionStorage.getItem.mockReturnValue(storedUrl);

      renderHook(() =>
        useAuthMiddleware({
          requireAuth: true,
          feature: 'profile',
          autoRedirect: true,
          redirectAfterAuth: providedUrl,
        })
      );

      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('auth_redirect_url');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('auth_redirect_url');
      expect(mockLocation.href).toBe(storedUrl);
    });
  });

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        refreshToken: vi.fn(),
      });
    });

    it('should deny access when authentication is required', () => {
      const { result } = renderHook(() =>
        useAuthMiddleware({ requireAuth: true, feature: 'recording' })
      );

      expect(result.current.canAccess).toBe(false);
      expect(result.current.isAuthModalOpen).toBe(false);
    });

    it('should allow access when authentication is not required', () => {
      const { result } = renderHook(() =>
        useAuthMiddleware({ requireAuth: false, feature: 'room-creation' })
      );

      expect(result.current.canAccess).toBe(true);
      expect(result.current.isAuthModalOpen).toBe(false);
    });

    it('should open auth modal when requestAuth is called', () => {
      const { result } = renderHook(() =>
        useAuthMiddleware({ requireAuth: true, feature: 'recording' })
      );

      act(() => {
        result.current.requestAuth();
      });

      expect(result.current.isAuthModalOpen).toBe(true);
    });

    it('should call custom onAuthRequired callback when provided', () => {
      const onAuthRequired = vi.fn();
      const { result } = renderHook(() =>
        useAuthMiddleware({
          requireAuth: true,
          feature: 'recording',
          onAuthRequired,
        })
      );

      act(() => {
        result.current.requestAuth();
      });

      expect(onAuthRequired).toHaveBeenCalled();
      expect(result.current.isAuthModalOpen).toBe(false); // Modal should not open when custom callback is provided
    });

    it('should store redirect URL when requestAuth is called', () => {
      const redirectUrl = '/return-here';
      const { result } = renderHook(() =>
        useAuthMiddleware({
          requireAuth: true,
          feature: 'recording',
          redirectAfterAuth: redirectUrl,
        })
      );

      act(() => {
        result.current.requestAuth();
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_redirect_url', redirectUrl);
    });

    it('should close auth modal when closeAuthModal is called', () => {
      const { result } = renderHook(() =>
        useAuthMiddleware({ requireAuth: true, feature: 'recording' })
      );

      act(() => {
        result.current.requestAuth();
      });

      expect(result.current.isAuthModalOpen).toBe(true);

      act(() => {
        result.current.closeAuthModal();
      });

      expect(result.current.isAuthModalOpen).toBe(false);
    });

    it('should not request auth when authentication is not required', () => {
      const onAuthRequired = vi.fn();
      const { result } = renderHook(() =>
        useAuthMiddleware({
          requireAuth: false,
          feature: 'room-creation',
          onAuthRequired,
        })
      );

      act(() => {
        result.current.requestAuth();
      });

      expect(onAuthRequired).not.toHaveBeenCalled();
      expect(result.current.isAuthModalOpen).toBe(false);
    });
  });

  describe('when loading', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        refreshToken: vi.fn(),
      });
    });

    it('should deny access while loading', () => {
      const { result } = renderHook(() =>
        useAuthMiddleware({ requireAuth: false, feature: 'room-creation' })
      );

      expect(result.current.canAccess).toBe(false);
    });
  });

  describe('predefined middleware configurations', () => {
    it('should have correct configuration for recording', () => {
      expect(authMiddlewareConfigs.recording).toEqual({
        requireAuth: true,
        feature: 'recording',
      });
    });

    it('should have correct configuration for profile', () => {
      expect(authMiddlewareConfigs.profile).toEqual({
        requireAuth: true,
        feature: 'profile',
      });
    });

    it('should have correct configuration for room creation', () => {
      expect(authMiddlewareConfigs.roomCreation).toEqual({
        requireAuth: false,
        feature: 'room-creation',
      });
    });

    it('should have correct configuration for room management', () => {
      expect(authMiddlewareConfigs.roomManagement).toEqual({
        requireAuth: true,
        feature: 'room-management',
      });
    });
  });

  describe('feature-specific hooks', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: { id: '1', email: 'test@example.com', username: 'testuser' },
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        refreshToken: vi.fn(),
      });
    });

    it('should work with useRecordingAuth', async () => {
      const { useRecordingAuth } = await import('../useAuthMiddleware');
      const { result } = renderHook(() => useRecordingAuth());

      expect(result.current.canAccess).toBe(true);
      expect(result.current.authRequiredFeature).toBe('recording');
    });

    it('should work with useProfileAuth', async () => {
      const { useProfileAuth } = await import('../useAuthMiddleware');
      const { result } = renderHook(() => useProfileAuth());

      expect(result.current.canAccess).toBe(true);
      expect(result.current.authRequiredFeature).toBe('profile');
    });

    it('should work with useRoomCreationAuth', async () => {
      const { useRoomCreationAuth } = await import('../useAuthMiddleware');
      const { result } = renderHook(() => useRoomCreationAuth());

      expect(result.current.canAccess).toBe(true);
      expect(result.current.authRequiredFeature).toBe('room-creation');
    });

    it('should work with useRoomManagementAuth', async () => {
      const { useRoomManagementAuth } = await import('../useAuthMiddleware');
      const { result } = renderHook(() => useRoomManagementAuth());

      expect(result.current.canAccess).toBe(true);
      expect(result.current.authRequiredFeature).toBe('room-management');
    });
  });
});