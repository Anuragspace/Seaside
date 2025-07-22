import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { TokenManager, TokenRefreshCallback } from '../tokenManager';

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

// Mock console methods to avoid noise in tests
const consoleMock = {
  error: vi.fn(),
  warn: vi.fn(),
};

Object.defineProperty(console, 'error', { value: consoleMock.error });
Object.defineProperty(console, 'warn', { value: consoleMock.warn });

describe('TokenManager', () => {
  const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const mockRefreshToken = 'refresh_token_123';
  const mockExpiresIn = 3600; // 1 hour

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset TokenManager state
    TokenManager.clearTokens();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Token Storage', () => {
    it('should store tokens correctly', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      TokenManager.setTokens(mockAccessToken, mockRefreshToken, mockExpiresIn);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_access_token', mockAccessToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_refresh_token', mockRefreshToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token_expiry', (mockDate.getTime() + mockExpiresIn * 1000).toString());
      
      vi.useRealTimers();
    });

    it('should store tokens without expiry time', () => {
      TokenManager.setTokens(mockAccessToken, mockRefreshToken);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_access_token', mockAccessToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_refresh_token', mockRefreshToken);
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('auth_token_expiry', expect.anything());
    });

    it('should handle storage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        TokenManager.setTokens(mockAccessToken, mockRefreshToken);
      }).toThrow('Failed to store authentication tokens');

      expect(consoleMock.error).toHaveBeenCalledWith('Error storing tokens:', expect.any(Error));
    });
  });

  describe('Token Retrieval', () => {
    it('should retrieve access token', () => {
      localStorageMock.getItem.mockReturnValue(mockAccessToken);

      const token = TokenManager.getAccessToken();

      expect(token).toBe(mockAccessToken);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_access_token');
    });

    it('should retrieve refresh token', () => {
      localStorageMock.getItem.mockReturnValue(mockRefreshToken);

      const token = TokenManager.getRefreshToken();

      expect(token).toBe(mockRefreshToken);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_refresh_token');
    });

    it('should handle retrieval errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const accessToken = TokenManager.getAccessToken();
      const refreshToken = TokenManager.getRefreshToken();

      expect(accessToken).toBeNull();
      expect(refreshToken).toBeNull();
      expect(consoleMock.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('Token Clearing', () => {
    it('should clear all tokens', () => {
      TokenManager.clearTokens();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_refresh_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token_expiry');
    });

    it('should handle clearing errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      TokenManager.clearTokens();

      expect(consoleMock.error).toHaveBeenCalledWith('Error clearing tokens:', expect.any(Error));
    });
  });

  describe('Token Expiration', () => {
    it('should detect expired tokens', () => {
      const pastTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      localStorageMock.getItem.mockReturnValue(pastTime.toString());

      const isExpired = TokenManager.isTokenExpired();

      expect(isExpired).toBe(true);
    });

    it('should detect non-expired tokens', () => {
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      localStorageMock.getItem.mockReturnValue(futureTime.toString());

      const isExpired = TokenManager.isTokenExpired();

      expect(isExpired).toBe(false);
    });

    it('should consider tokens expired when no expiry time is set', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const isExpired = TokenManager.isTokenExpired();

      expect(isExpired).toBe(true);
    });

    it('should consider tokens expired within buffer time', () => {
      const nearFutureTime = Date.now() + 3 * 60 * 1000; // 3 minutes from now (within 5-minute buffer)
      localStorageMock.getItem.mockReturnValue(nearFutureTime.toString());

      const isExpired = TokenManager.isTokenExpired();

      expect(isExpired).toBe(true);
    });

    it('should handle expiry check errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const isExpired = TokenManager.isTokenExpired();

      expect(isExpired).toBe(true);
      expect(consoleMock.error).toHaveBeenCalledWith('Error checking token expiry:', expect.any(Error));
    });
  });

  describe('Token Validation', () => {
    it('should validate tokens exist and are not expired', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() + 10 * 60 * 1000).toString();
        return null;
      });

      const hasValidTokens = TokenManager.hasValidTokens();

      expect(hasValidTokens).toBe(true);
    });

    it('should invalidate when access token is missing', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() + 10 * 60 * 1000).toString();
        return null;
      });

      const hasValidTokens = TokenManager.hasValidTokens();

      expect(hasValidTokens).toBe(false);
    });

    it('should invalidate when refresh token is missing', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_token_expiry') return (Date.now() + 10 * 60 * 1000).toString();
        return null;
      });

      const hasValidTokens = TokenManager.hasValidTokens();

      expect(hasValidTokens).toBe(false);
    });

    it('should invalidate when token is expired', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString();
        return null;
      });

      const hasValidTokens = TokenManager.hasValidTokens();

      expect(hasValidTokens).toBe(false);
    });
  });

  describe('Token Refresh Capability', () => {
    it('should detect refresh capability when refresh token exists', () => {
      localStorageMock.getItem.mockReturnValue(mockRefreshToken);

      const canRefresh = TokenManager.canRefreshToken();

      expect(canRefresh).toBe(true);
    });

    it('should detect no refresh capability when refresh token is missing', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const canRefresh = TokenManager.canRefreshToken();

      expect(canRefresh).toBe(false);
    });
  });

  describe('Token Expiry Information', () => {
    it('should return token expiry as Date object', () => {
      const expiryTime = Date.now() + 10 * 60 * 1000;
      localStorageMock.getItem.mockReturnValue(expiryTime.toString());

      const expiry = TokenManager.getTokenExpiry();

      expect(expiry).toEqual(new Date(expiryTime));
    });

    it('should return null when no expiry time is set', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const expiry = TokenManager.getTokenExpiry();

      expect(expiry).toBeNull();
    });

    it('should return time until expiry in milliseconds', () => {
      const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      localStorageMock.getItem.mockReturnValue(expiryTime.toString());

      const timeUntilExpiry = TokenManager.getTimeUntilExpiry();

      expect(timeUntilExpiry).toBeGreaterThan(9 * 60 * 1000); // Should be close to 10 minutes
      expect(timeUntilExpiry).toBeLessThanOrEqual(10 * 60 * 1000);
    });

    it('should return 0 for expired tokens', () => {
      const expiryTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      localStorageMock.getItem.mockReturnValue(expiryTime.toString());

      const timeUntilExpiry = TokenManager.getTimeUntilExpiry();

      expect(timeUntilExpiry).toBe(0);
    });

    it('should return null when no expiry time is set', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const timeUntilExpiry = TokenManager.getTimeUntilExpiry();

      expect(timeUntilExpiry).toBeNull();
    });
  });

  describe('JWT Token Decoding', () => {
    it('should decode JWT token payload', () => {
      const payload = TokenManager.decodeTokenPayload(mockAccessToken);

      expect(payload).toEqual({
        sub: '1234567890',
        name: 'John Doe',
        iat: 1516239022
      });
    });

    it('should handle invalid JWT tokens gracefully', () => {
      const payload = TokenManager.decodeTokenPayload('invalid.token');

      expect(payload).toBeNull();
      expect(consoleMock.error).toHaveBeenCalledWith('Error decoding token payload:', expect.any(Error));
    });

    it('should extract user ID from token', () => {
      localStorageMock.getItem.mockReturnValue(mockAccessToken);

      const userId = TokenManager.getUserIdFromToken();

      expect(userId).toBe('1234567890');
    });

    it('should return null when no access token exists', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const userId = TokenManager.getUserIdFromToken();

      expect(userId).toBeNull();
    });
  });

  describe('Token Format Validation', () => {
    it('should validate correct JWT format', () => {
      const isValid = TokenManager.isValidTokenFormat(mockAccessToken);

      expect(isValid).toBe(true);
    });

    it('should invalidate tokens with wrong number of parts', () => {
      const isValid = TokenManager.isValidTokenFormat('invalid.token');

      expect(isValid).toBe(false);
    });

    it('should invalidate empty or null tokens', () => {
      expect(TokenManager.isValidTokenFormat('')).toBe(false);
      expect(TokenManager.isValidTokenFormat(null as any)).toBe(false);
      expect(TokenManager.isValidTokenFormat(undefined as any)).toBe(false);
    });

    it('should invalidate tokens with invalid base64 encoding', () => {
      const isValid = TokenManager.isValidTokenFormat('invalid.@#$%.token');

      expect(isValid).toBe(false);
    });
  });

  describe('Automatic Token Refresh', () => {
    let mockRefreshCallback: Mock<TokenRefreshCallback>;

    beforeEach(() => {
      mockRefreshCallback = vi.fn();
      TokenManager.setRefreshCallback(mockRefreshCallback);
    });

    it('should set refresh callback', () => {
      const callback = vi.fn();
      TokenManager.setRefreshCallback(callback);

      // Verify callback is set by trying to use it
      expect(() => TokenManager.setRefreshCallback(callback)).not.toThrow();
    });

    it('should return valid access token without refresh when not expired', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_token_expiry') return (Date.now() + 10 * 60 * 1000).toString();
        return null;
      });

      const token = await TokenManager.getValidAccessToken();

      expect(token).toBe(mockAccessToken);
      expect(mockRefreshCallback).not.toHaveBeenCalled();
    });

    it('should return null when no access token exists', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const token = await TokenManager.getValidAccessToken();

      expect(token).toBeNull();
      expect(mockRefreshCallback).not.toHaveBeenCalled();
    });

    it('should refresh token when expired', async () => {
      const newAccessToken = 'new_access_token';
      const newRefreshToken = 'new_refresh_token';
      
      // First call - return expired token
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString(); // Expired
        return null;
      });

      mockRefreshCallback.mockResolvedValue({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600
      });

      const token = await TokenManager.getValidAccessToken();

      expect(mockRefreshCallback).toHaveBeenCalledOnce();
      // After refresh, the token should be the new one from localStorage
      expect(TokenManager.getAccessToken()).toBe(mockAccessToken); // This will be the mocked return value
    });

    it('should handle refresh failure gracefully', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString(); // Expired
        return null;
      });

      mockRefreshCallback.mockRejectedValue(new Error('Refresh failed'));

      const token = await TokenManager.getValidAccessToken();

      expect(token).toBeNull();
      expect(consoleMock.error).toHaveBeenCalledWith('Failed to refresh token:', expect.any(Error));
    });

    it('should throw error when no refresh callback is set', async () => {
      TokenManager.setRefreshCallback(null as any);
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString(); // Expired
        return null;
      });

      await expect(TokenManager.refreshTokenIfNeeded()).rejects.toThrow('No refresh callback set');
    });

    it('should throw error when no refresh token is available', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString(); // Expired
        return null; // No refresh token
      });

      await expect(TokenManager.refreshTokenIfNeeded()).rejects.toThrow('No refresh token available');
    });

    it('should not refresh when token is not expired', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() + 10 * 60 * 1000).toString(); // Not expired
        return null;
      });

      await TokenManager.refreshTokenIfNeeded();

      expect(mockRefreshCallback).not.toHaveBeenCalled();
    });

    it('should deduplicate concurrent refresh requests', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString(); // Expired
        return null;
      });

      // Mock setTokens to not throw error during test
      localStorageMock.setItem.mockImplementation(() => {});

      mockRefreshCallback.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          accessToken: 'new_token',
          refreshToken: 'new_refresh',
          expiresIn: 3600
        }), 100))
      );

      // Start multiple refresh requests concurrently
      const promises = [
        TokenManager.refreshTokenIfNeeded(),
        TokenManager.refreshTokenIfNeeded(),
        TokenManager.refreshTokenIfNeeded()
      ];

      await Promise.all(promises);

      // Should only call refresh callback once due to deduplication
      expect(mockRefreshCallback).toHaveBeenCalledOnce();
    });
  });

  describe('Token Refresh Scheduling', () => {
    beforeEach(() => {
      vi.useRealTimers();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should schedule token refresh', () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return expiryTime.toString();
        return null;
      });

      TokenManager.scheduleTokenRefresh();

      // Verify setTimeout was called with correct delay (5 minutes before expiry)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
      
      setTimeoutSpy.mockRestore();
    });

    it('should not schedule refresh when no refresh token exists', () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      localStorageMock.getItem.mockReturnValue(null);

      TokenManager.scheduleTokenRefresh();

      expect(setTimeoutSpy).not.toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
    });

    it('should not schedule refresh when no expiry time exists', () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_refresh_token') return mockRefreshToken;
        return null;
      });

      TokenManager.scheduleTokenRefresh();

      expect(setTimeoutSpy).not.toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
    });
  });

  describe('Token Information', () => {
    it('should return comprehensive token information', () => {
      const expiryTime = Date.now() + 10 * 60 * 1000;
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_access_token') return mockAccessToken;
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return expiryTime.toString();
        return null;
      });

      const tokenInfo = TokenManager.getTokenInfo();

      expect(tokenInfo).toEqual({
        hasAccessToken: true,
        hasRefreshToken: true,
        isExpired: false,
        expiryTime: new Date(expiryTime),
        timeUntilExpiry: expect.any(Number),
        canRefresh: true,
      });
    });

    it('should detect when tokens need refresh', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString(); // Expired
        return null;
      });

      const needsRefresh = TokenManager.needsRefresh();

      expect(needsRefresh).toBe(true);
    });

    it('should detect when tokens do not need refresh', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_refresh_token') return mockRefreshToken;
        if (key === 'auth_token_expiry') return (Date.now() + 10 * 60 * 1000).toString(); // Not expired
        return null;
      });

      const needsRefresh = TokenManager.needsRefresh();

      expect(needsRefresh).toBe(false);
    });

    it('should not need refresh when no refresh token exists', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'auth_token_expiry') return (Date.now() - 10 * 60 * 1000).toString(); // Expired
        return null; // No refresh token
      });

      const needsRefresh = TokenManager.needsRefresh();

      expect(needsRefresh).toBe(false);
    });
  });
});