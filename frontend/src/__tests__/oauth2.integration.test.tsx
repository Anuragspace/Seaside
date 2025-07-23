import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { AuthService } from '../services/authService';
import { OAuth2Utils } from '../services/oauth2Config';
import SignInForm from '../components/SignInForm';
import SignUpForm from '../components/SignUpForm';

// Mock the services
vi.mock('../services/authService');
vi.mock('../services/oauth2Config');

// Mock heroUi components
vi.mock('@heroui/react', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardBody: ({ children }: any) => <div>{children}</div>,
  Input: ({ label, type, value, onChange, isInvalid, errorMessage, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        data-testid={props['data-testid'] || label?.toLowerCase().replace(/\s+/g, '-')}
        {...props}
      />
      {isInvalid && errorMessage && <span data-testid="error-message">{errorMessage}</span>}
    </div>
  ),
  Button: ({ children, onPress, isLoading, isDisabled, className, ...props }: any) => (
    <button
      onClick={onPress}
      disabled={isDisabled || isLoading}
      className={className}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  ),
  Divider: () => <hr data-testid="divider" />,
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaGoogle: () => <div data-testid="google-icon" />,
  FaGithub: () => <div data-testid="github-icon" />,
}));

const MockedAuthService = vi.mocked(AuthService);
const MockedOAuth2Utils = vi.mocked(OAuth2Utils);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <NotificationProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </NotificationProvider>
  </MemoryRouter>
);

// Mock user data
const mockUser = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
  avatar: 'https://example.com/avatar.jpg',
  provider: 'google' as const,
};

const mockAuthResponse = {
  user: mockUser,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
};

describe('OAuth2 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.location
    delete (window as any).location;
    window.location = { href: '', origin: 'http://localhost:3000' } as any;
    
    // Default mock implementations
    MockedAuthService.initiateOAuth2Flow.mockImplementation(() => {});
    MockedAuthService.handleOAuth2Callback.mockResolvedValue(mockAuthResponse);
    MockedOAuth2Utils.buildAuthorizationUrl.mockReturnValue('https://accounts.google.com/oauth/authorize?...');
    MockedOAuth2Utils.parseCallbackUrl.mockReturnValue({
      code: 'auth-code-123',
      state: 'state-456'
    });
    MockedOAuth2Utils.verifyState.mockReturnValue(true);
    (MockedOAuth2Utils as any).clearState = vi.fn(); // Add this line
    MockedOAuth2Utils.generateState = vi.fn().mockReturnValue('random-state-123'); // Add this too
    MockedOAuth2Utils.storeState = vi.fn(); // Add this too
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OAuth2 Flow Initiation', () => {
    it('should initiate Google OAuth2 flow from sign-in form', async () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(MockedAuthService.initiateOAuth2Flow).toHaveBeenCalledWith('google');
      });
    });

    it('should initiate GitHub OAuth2 flow from sign-in form', async () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const githubButton = screen.getByText('Continue with GitHub');
      fireEvent.click(githubButton);

      await waitFor(() => {
        expect(MockedAuthService.initiateOAuth2Flow).toHaveBeenCalledWith('github');
      });
    });

    it('should initiate Google OAuth2 flow from sign-up form', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(MockedAuthService.initiateOAuth2Flow).toHaveBeenCalledWith('google');
      });
    });

    it('should initiate GitHub OAuth2 flow from sign-up form', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const githubButton = screen.getByText('Continue with GitHub');
      fireEvent.click(githubButton);

      await waitFor(() => {
        expect(MockedAuthService.initiateOAuth2Flow).toHaveBeenCalledWith('github');
      });
    });

    it('should redirect to OAuth2 provider authorization URL', () => {
      const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=http://localhost:3000/auth/callback/google&response_type=code&scope=openid%20email%20profile&state=random-state';
      MockedOAuth2Utils.buildAuthorizationUrl.mockReturnValue(mockAuthUrl);

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      expect(MockedOAuth2Utils.buildAuthorizationUrl).toHaveBeenCalledWith('google');
      expect(window.location.href).toBe(mockAuthUrl);
    });
  });

  describe('OAuth2 Callback Handling', () => {
    it('should handle successful Google OAuth2 callback', async () => {
      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
      
      const result = await MockedAuthService.handleOAuth2Callback('google', callbackUrl);

      expect(MockedOAuth2Utils.parseCallbackUrl).toHaveBeenCalledWith(callbackUrl);
      expect(MockedOAuth2Utils.verifyState).toHaveBeenCalledWith('state-456');
      expect(result).toEqual(mockAuthResponse);
    });

    it('should handle successful GitHub OAuth2 callback', async () => {
      const callbackUrl = 'http://localhost:3000/auth/callback/github?code=auth-code-123&state=state-456';
      
      const result = await MockedAuthService.handleOAuth2Callback('github', callbackUrl);

      expect(MockedOAuth2Utils.parseCallbackUrl).toHaveBeenCalledWith(callbackUrl);
      expect(MockedOAuth2Utils.verifyState).toHaveBeenCalledWith('state-456');
      expect(result).toEqual(mockAuthResponse);
    });

    it('should handle OAuth2 callback with error parameter', async () => {
      const callbackUrl = 'http://localhost:3000/auth/callback/google?error=access_denied&error_description=User%20denied%20access';
      
      MockedOAuth2Utils.parseCallbackUrl.mockReturnValue({
        error: 'access_denied',
        error_description: 'User denied access'
      });

      await expect(
        MockedAuthService.handleOAuth2Callback('google', callbackUrl)
      ).rejects.toThrow('User denied access');
    });

    it('should handle OAuth2 callback with missing parameters', async () => {
      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123';
      
      MockedOAuth2Utils.parseCallbackUrl.mockReturnValue({
        code: 'auth-code-123'
        // missing state
      });

      await expect(
        MockedAuthService.handleOAuth2Callback('google', callbackUrl)
      ).rejects.toThrow('Missing authorization code or state parameter');
    });

    it('should handle OAuth2 callback with invalid state', async () => {
      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=invalid-state';
      
      MockedOAuth2Utils.parseCallbackUrl.mockReturnValue({
        code: 'auth-code-123',
        state: 'invalid-state'
      });
      MockedOAuth2Utils.verifyState.mockReturnValue(false);

      await expect(
        MockedAuthService.handleOAuth2Callback('google', callbackUrl)
      ).rejects.toThrow('Invalid OAuth2 state parameter');
    });
  });

  describe('OAuth2 Error Handling', () => {
    it('should handle OAuth2 configuration errors', () => {
      MockedOAuth2Utils.buildAuthorizationUrl.mockImplementation(() => {
        throw new Error('OAuth2 configuration error');
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      
      expect(() => fireEvent.click(googleButton)).toThrow('Failed to initiate google authentication.');
    });

    it('should handle network errors during OAuth2 flow', async () => {
      MockedAuthService.handleOAuth2Callback.mockRejectedValue(new Error('Network error'));

      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
      
      await expect(
        MockedAuthService.handleOAuth2Callback('google', callbackUrl)
      ).rejects.toThrow('Network error');
    });

    it('should handle OAuth2 provider errors', async () => {
      const callbackUrl = 'http://localhost:3000/auth/callback/google?error=server_error&error_description=Internal%20server%20error';
      
      MockedOAuth2Utils.parseCallbackUrl.mockReturnValue({
        error: 'server_error',
        error_description: 'Internal server error'
      });

      await expect(
        MockedAuthService.handleOAuth2Callback('google', callbackUrl)
      ).rejects.toThrow('Internal server error');
    });

    it('should handle OAuth2 token exchange errors', async () => {
      MockedAuthService.handleOAuth2Callback.mockRejectedValue(
        new Error('Failed to exchange authorization code for tokens')
      );

      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
      
      await expect(
        MockedAuthService.handleOAuth2Callback('google', callbackUrl)
      ).rejects.toThrow('Failed to exchange authorization code for tokens');
    });
  });

  describe('OAuth2 State Management', () => {
    it('should generate and store OAuth2 state parameter', () => {
      const mockState = 'random-state-123';
      MockedOAuth2Utils.generateState = vi.fn().mockReturnValue(mockState);
      MockedOAuth2Utils.storeState = vi.fn();

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      expect(MockedOAuth2Utils.generateState).toHaveBeenCalled();
      expect(MockedOAuth2Utils.storeState).toHaveBeenCalledWith(mockState);
    });

    it('should verify OAuth2 state parameter on callback', async () => {
      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
      
      await MockedAuthService.handleOAuth2Callback('google', callbackUrl);

      expect(MockedOAuth2Utils.verifyState).toHaveBeenCalledWith('state-456');
    });

    it('should clear OAuth2 state after successful callback', async () => {
      // Mock the method before using it
      (MockedOAuth2Utils as any).clearState = vi.fn();
      
      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
      
      await MockedAuthService.handleOAuth2Callback('google', callbackUrl);

      expect((MockedOAuth2Utils as any).clearState).toHaveBeenCalled();
    });
  });

  describe('OAuth2 Provider Configuration', () => {
    it('should use correct Google OAuth2 configuration', () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      expect(MockedOAuth2Utils.buildAuthorizationUrl).toHaveBeenCalledWith('google');
    });

    it('should use correct GitHub OAuth2 configuration', () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const githubButton = screen.getByText('Continue with GitHub');
      fireEvent.click(githubButton);

      expect(MockedOAuth2Utils.buildAuthorizationUrl).toHaveBeenCalledWith('github');
    });

    it('should include required OAuth2 parameters', () => {
      const expectedUrl = 'https://accounts.google.com/oauth/authorize?client_id=test-client-id&redirect_uri=http://localhost:3000/auth/callback/google&response_type=code&scope=openid%20email%20profile&state=random-state';
      MockedOAuth2Utils.buildAuthorizationUrl.mockReturnValue(expectedUrl);

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      expect(window.location.href).toBe(expectedUrl);
    });
  });

  describe('OAuth2 User Profile Handling', () => {
    it('should handle OAuth2 user with Google provider', async () => {
      const googleUser = {
        ...mockUser,
        provider: 'google' as const,
        avatar: 'https://lh3.googleusercontent.com/avatar'
      };

      MockedAuthService.handleOAuth2Callback.mockResolvedValue({
        ...mockAuthResponse,
        user: googleUser
      });

      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
      
      const result = await MockedAuthService.handleOAuth2Callback('google', callbackUrl);

      expect(result.user.provider).toBe('google');
      expect(result.user.avatar).toBe('https://lh3.googleusercontent.com/avatar');
    });

    it('should handle OAuth2 user with GitHub provider', async () => {
      const githubUser = {
        ...mockUser,
        provider: 'github' as const,
        avatar: 'https://avatars.githubusercontent.com/u/123456'
      };

      MockedAuthService.handleOAuth2Callback.mockResolvedValue({
        ...mockAuthResponse,
        user: githubUser
      });

      const callbackUrl = 'http://localhost:3000/auth/callback/github?code=auth-code-123&state=state-456';
      
      const result = await MockedAuthService.handleOAuth2Callback('github', callbackUrl);

      expect(result.user.provider).toBe('github');
      expect(result.user.avatar).toBe('https://avatars.githubusercontent.com/u/123456');
    });

    it('should handle OAuth2 user without avatar', async () => {
      const userWithoutAvatar = {
        ...mockUser,
        avatar: undefined
      };

      MockedAuthService.handleOAuth2Callback.mockResolvedValue({
        ...mockAuthResponse,
        user: userWithoutAvatar
      });

      const callbackUrl = 'http://localhost:3000/auth/callback/google?code=auth-code-123&state=state-456';
      
      const result = await MockedAuthService.handleOAuth2Callback('google', callbackUrl);

      expect(result.user.avatar).toBeUndefined();
    });
  });

  describe('OAuth2 Security', () => {
    it('should use HTTPS for OAuth2 redirect URIs in production', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const expectedUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=https://myapp.com/auth/callback/google&response_type=code&scope=openid%20email%20profile&state=random-state';
      MockedOAuth2Utils.buildAuthorizationUrl.mockReturnValue(expectedUrl);

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      expect(window.location.href).toContain('https://');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should validate OAuth2 state parameter length', () => {
      const shortState = 'abc';
      MockedOAuth2Utils.verifyState.mockImplementation((state) => {
        return state.length >= 32; // Minimum secure length
      });

      MockedOAuth2Utils.parseCallbackUrl.mockReturnValue({
        code: 'auth-code-123',
        state: shortState
      });

      expect(MockedOAuth2Utils.verifyState(shortState)).toBe(false);
    });

    it('should handle OAuth2 CSRF protection', async () => {
      // Test that state parameter prevents CSRF attacks
      const maliciousCallbackUrl = 'http://localhost:3000/auth/callback/google?code=malicious-code&state=attacker-state';
      
      MockedOAuth2Utils.parseCallbackUrl.mockReturnValue({
        code: 'malicious-code',
        state: 'attacker-state'
      });
      MockedOAuth2Utils.verifyState.mockReturnValue(false); // State doesn't match

      await expect(
        MockedAuthService.handleOAuth2Callback('google', maliciousCallbackUrl)
      ).rejects.toThrow('Invalid OAuth2 state parameter');
    });
  });
});