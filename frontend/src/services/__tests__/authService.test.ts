import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AuthService, { AuthError } from '../authService';
import { TokenManager } from '../../utils/tokenManager';
import { OAuth2Utils } from '../oauth2Config';
import type { SignInData, SignUpData, AuthResponse, User } from '../../contexts/AuthContext';

// Mock dependencies
vi.mock('../../utils/tokenManager');
vi.mock('../oauth2Config');

const mockTokenManager = vi.mocked(TokenManager);
const mockOAuth2Utils = vi.mocked(OAuth2Utils);

describe('AuthService', () => {
  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    username: 'testuser',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'email',
  };

  const mockAuthResponse: AuthResponse = {
    user: mockUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  };

  const mockSignInData: SignInData = {
    email: 'test@example.com',
    password: 'password123',
  };

  const mockSignUpData: SignUpData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful fetch by default
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockAuthResponse),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signIn', () => {
    it('should successfully sign in with valid credentials', async () => {
      const result = await AuthService.signIn(mockSignInData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(mockSignInData),
        })
      );

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith(
        mockAuthResponse.accessToken,
        mockAuthResponse.refreshToken,
        mockAuthResponse.expiresIn
      );

      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw AuthError for invalid credentials', async () => {
      const errorResponse = {
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue(errorResponse),
      });

      await expect(AuthService.signIn(mockSignInData)).rejects.toThrow(
        new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      );

      expect(mockTokenManager.setTokens).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(AuthService.signIn(mockSignInData)).rejects.toThrow(
        new AuthError('Network error occurred. Please check your connection.', 0, 'NETWORK_ERROR')
      );
    });

    it('should not include authorization header for sign in request', async () => {
      // Sign in requests should not include authorization headers
      await AuthService.signIn(mockSignInData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/auth/login',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });
  });

  describe('signUp', () => {
    it('should successfully sign up with valid data', async () => {
      const result = await AuthService.signUp(mockSignUpData);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(mockSignUpData),
        })
      );

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith(
        mockAuthResponse.accessToken,
        mockAuthResponse.refreshToken,
        mockAuthResponse.expiresIn
      );

      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw AuthError for validation errors', async () => {
      const errorResponse = {
        message: 'Email already exists',
        code: 'EMAIL_EXISTS',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue(errorResponse),
      });

      await expect(AuthService.signUp(mockSignUpData)).rejects.toThrow(
        new AuthError('Email already exists', 400, 'EMAIL_EXISTS')
      );
    });
  });

  describe('signInWithOAuth', () => {
    const mockCode = 'oauth-code-123';
    const mockState = 'oauth-state-456';

    beforeEach(() => {
      mockOAuth2Utils.verifyState.mockReturnValue(true);
    });

    it('should successfully sign in with OAuth2', async () => {
      const result = await AuthService.signInWithOAuth('google', mockCode, mockState);

      expect(mockOAuth2Utils.verifyState).toHaveBeenCalledWith(mockState);
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/auth/oauth/google',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: mockCode, state: mockState }),
        })
      );

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith(
        mockAuthResponse.accessToken,
        mockAuthResponse.refreshToken,
        mockAuthResponse.expiresIn
      );

      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw AuthError for invalid state', async () => {
      mockOAuth2Utils.verifyState.mockReturnValue(false);

      await expect(
        AuthService.signInWithOAuth('google', mockCode, mockState)
      ).rejects.toThrow(
        new AuthError('Invalid OAuth2 state parameter', 400, 'INVALID_STATE')
      );

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle OAuth2 provider errors', async () => {
      const errorResponse = {
        message: 'OAuth2 provider error',
        code: 'OAUTH_ERROR',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue(errorResponse),
      });

      await expect(
        AuthService.signInWithOAuth('github', mockCode, mockState)
      ).rejects.toThrow(
        new AuthError('OAuth2 provider error', 400, 'OAUTH_ERROR')
      );
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'refresh-token-123';

    it('should successfully refresh tokens', async () => {
      mockTokenManager.getRefreshToken.mockReturnValue(mockRefreshToken);

      const result = await AuthService.refreshToken();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: mockRefreshToken }),
        })
      );

      expect(mockTokenManager.setTokens).toHaveBeenCalledWith(
        mockAuthResponse.accessToken,
        mockAuthResponse.refreshToken,
        mockAuthResponse.expiresIn
      );

      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw AuthError when no refresh token exists', async () => {
      mockTokenManager.getRefreshToken.mockReturnValue(null);

      await expect(AuthService.refreshToken()).rejects.toThrow(
        new AuthError('No refresh token available', 401, 'NO_REFRESH_TOKEN')
      );

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should clear tokens when refresh fails', async () => {
      mockTokenManager.getRefreshToken.mockReturnValue(mockRefreshToken);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ message: 'Invalid refresh token' }),
      });

      await expect(AuthService.refreshToken()).rejects.toThrow(AuthError);

      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    const mockRefreshToken = 'refresh-token-123';

    it('should successfully sign out with server notification', async () => {
      mockTokenManager.getRefreshToken.mockReturnValue(mockRefreshToken);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      await AuthService.signOut();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/auth/logout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: mockRefreshToken }),
        })
      );

      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
    });

    it('should clear tokens even if server request fails', async () => {
      mockTokenManager.getRefreshToken.mockReturnValue(mockRefreshToken);

      global.fetch = vi.fn().mockRejectedValue(new Error('Server error'));

      // Should not throw error
      await AuthService.signOut();

      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
    });

    it('should clear tokens when no refresh token exists', async () => {
      mockTokenManager.getRefreshToken.mockReturnValue(null);

      await AuthService.signOut();

      expect(fetch).not.toHaveBeenCalled();
      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should successfully get current user', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await AuthService.getCurrentUser();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockUser);
    });

    it('should clear tokens on 401 error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ message: 'Token expired' }),
      });

      await expect(AuthService.getCurrentUser()).rejects.toThrow(AuthError);

      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when tokens are valid', () => {
      mockTokenManager.hasValidTokens.mockReturnValue(true);

      const result = AuthService.isAuthenticated();

      expect(result).toBe(true);
      expect(mockTokenManager.hasValidTokens).toHaveBeenCalled();
    });

    it('should return false when tokens are invalid', () => {
      mockTokenManager.hasValidTokens.mockReturnValue(false);

      const result = AuthService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('initiateOAuth2Flow', () => {
    it('should redirect to OAuth2 provider', () => {
      const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?...';
      mockOAuth2Utils.buildAuthorizationUrl.mockReturnValue(mockAuthUrl);

      // Mock window.location.href setter
      delete (window as any).location;
      window.location = { href: '' } as any;

      AuthService.initiateOAuth2Flow('google');

      expect(mockOAuth2Utils.buildAuthorizationUrl).toHaveBeenCalledWith('google');
      expect(window.location.href).toBe(mockAuthUrl);
    });

    it('should throw error if URL building fails', () => {
      mockOAuth2Utils.buildAuthorizationUrl.mockImplementation(() => {
        throw new Error('Config error');
      });

      expect(() => AuthService.initiateOAuth2Flow('google')).toThrow(
        new AuthError('Failed to initiate google authentication.')
      );
    });
  });

  describe('handleOAuth2Callback', () => {
    const mockCallbackUrl = 'http://localhost:3000/auth/callback/google?code=123&state=456';

    it('should handle successful OAuth2 callback', async () => {
      const mockParams = {
        code: '123',
        state: '456',
      };

      mockOAuth2Utils.parseCallbackUrl.mockReturnValue(mockParams);
      mockOAuth2Utils.verifyState.mockReturnValue(true);

      const result = await AuthService.handleOAuth2Callback('google', mockCallbackUrl);

      expect(mockOAuth2Utils.parseCallbackUrl).toHaveBeenCalledWith(mockCallbackUrl);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw error for OAuth2 error response', async () => {
      const mockParams = {
        error: 'access_denied',
        error_description: 'User denied access',
      };

      mockOAuth2Utils.parseCallbackUrl.mockReturnValue(mockParams);

      await expect(
        AuthService.handleOAuth2Callback('google', mockCallbackUrl)
      ).rejects.toThrow(
        new AuthError('User denied access', 400, 'access_denied')
      );
    });

    it('should throw error for missing parameters', async () => {
      const mockParams = {
        code: '123',
        // missing state
      };

      mockOAuth2Utils.parseCallbackUrl.mockReturnValue(mockParams);

      await expect(
        AuthService.handleOAuth2Callback('google', mockCallbackUrl)
      ).rejects.toThrow(
        new AuthError('Missing authorization code or state parameter', 400, 'MISSING_PARAMS')
      );
    });
  });

  describe('AuthError', () => {
    it('should create AuthError with all properties', () => {
      const error = new AuthError('Test message', 400, 'TEST_CODE');

      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AuthError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create AuthError with minimal properties', () => {
      const error = new AuthError('Test message');

      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBeUndefined();
      expect(error.code).toBeUndefined();
      expect(error.name).toBe('AuthError');
    });
  });
});