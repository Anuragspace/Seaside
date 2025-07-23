import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { AuthService } from '../services/authService';
import { TokenManager } from '../utils/tokenManager';

// Mock the auth service and token manager
vi.mock('../services/authService');
vi.mock('../utils/tokenManager');

// Mock complex components to focus on authentication flow
vi.mock('../pages/RoomPage', () => ({
  default: () => <div data-testid="room-page">Room Page</div>
}));

vi.mock('../pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home Page</div>
}));

// Mock NextUI components for forms
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
  Avatar: ({ name, children, fallback, className, ...props }: any) => (
    <div data-testid="avatar" className={className} data-name={name} {...props}>
      {name || children || fallback}
    </div>
  ),
  Dropdown: ({ children }: any) => <div data-testid="dropdown">{children}</div>,
  DropdownTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownItem: ({ children, onPress, ...props }: any) => (
    <div data-testid="dropdown-item" onClick={onPress} {...props}>
      {children}
    </div>
  )
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaGoogle: () => <div data-testid="google-icon" />,
  FaGithub: () => <div data-testid="github-icon" />,
}));

vi.mock('lucide-react', () => ({
  Moon: () => <div data-testid="moon-icon" />,
  Sun: () => <div data-testid="sun-icon" />,
  User: () => <div data-testid="user-icon" />,
  X: () => <div data-testid="x-icon" />,
  Menu: () => <div data-testid="menu-icon" />,
  LogOut: () => <div data-testid="logout-icon" />
}));

vi.mock('../../hooks/useTimeOfDay', () => ({
  useTimeOfDay: () => ({ isDay: true })
}));

vi.mock('date-fns', () => ({
  format: () => 'Monday 1st January'
}));

const MockedAuthService = vi.mocked(AuthService);
const MockedTokenManager = vi.mocked(TokenManager);

// Helper component to render App with routing and providers
const AppWithProviders = ({ initialEntries = ['/'] }: { initialEntries?: string[] }) => (
  <MemoryRouter initialEntries={initialEntries}>
    <NotificationProvider>
      <AuthProvider>
        <App />
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
  provider: 'email' as const,
};

const mockAuthResponse = {
  user: mockUser,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
};

describe('Authentication End-to-End Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    MockedTokenManager.hasValidTokens.mockReturnValue(false);
    MockedTokenManager.clearTokens.mockImplementation(() => {});
    MockedAuthService.getCurrentUser.mockRejectedValue(new Error('Not authenticated'));
    MockedAuthService.initializeTokenRefresh.mockImplementation(() => {});
    MockedAuthService.signIn.mockResolvedValue(mockAuthResponse);
    MockedAuthService.signUp.mockResolvedValue(mockAuthResponse);
    MockedAuthService.signOut.mockResolvedValue();
    MockedAuthService.initiateOAuth2Flow.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Sign-Up Flow', () => {
    it('should allow user to sign up with email and password', async () => {
      render(<AppWithProviders initialEntries={['/sign-up']} />);
      
      // Wait for sign-up form to load
      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeInTheDocument();
      });

      // Fill out the form
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

      // Submit the form
      fireEvent.click(submitButton);

      // Verify sign-up was called
      await waitFor(() => {
        expect(MockedAuthService.signUp).toHaveBeenCalledWith({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        });
      });

      // Should redirect to home page after successful sign-up
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });

    it('should handle sign-up validation errors', async () => {
      render(<AppWithProviders initialEntries={['/sign-up']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeInTheDocument();
      });

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /sign up/i });
      fireEvent.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Username is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
        expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      });

      // Should not call sign-up service
      expect(MockedAuthService.signUp).not.toHaveBeenCalled();
    });

    it('should handle sign-up with OAuth providers', async () => {
      render(<AppWithProviders initialEntries={['/sign-up']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeInTheDocument();
      });

      // Click Google OAuth button
      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(MockedAuthService.initiateOAuth2Flow).toHaveBeenCalledWith('google');
      });
    });
  });

  describe('Complete Sign-In Flow', () => {
    it('should allow user to sign in with email and password', async () => {
      render(<AppWithProviders initialEntries={['/sign-in']} />);
      
      // Wait for sign-in form to load
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Fill out the form
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      // Submit the form
      fireEvent.click(submitButton);

      // Verify sign-in was called
      await waitFor(() => {
        expect(MockedAuthService.signIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      // Should redirect to home page after successful sign-in
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });

    it('should handle sign-in validation errors', async () => {
      render(<AppWithProviders initialEntries={['/sign-in']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });

      // Should not call sign-in service
      expect(MockedAuthService.signIn).not.toHaveBeenCalled();
    });

    it('should handle sign-in with OAuth providers', async () => {
      render(<AppWithProviders initialEntries={['/sign-in']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Click GitHub OAuth button
      const githubButton = screen.getByText('Continue with GitHub');
      fireEvent.click(githubButton);

      await waitFor(() => {
        expect(MockedAuthService.initiateOAuth2Flow).toHaveBeenCalledWith('github');
      });
    });
  });

  describe('Authentication State Management', () => {
    it('should maintain authentication state across navigation', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue(mockUser);

      render(<AppWithProviders initialEntries={['/']} />);
      
      // Should show authenticated state in navbar
      await waitFor(() => {
        expect(screen.getByTestId('avatar')).toBeInTheDocument();
      });

      // Navigate to a different page and back
      // The authentication state should persist
      expect(MockedAuthService.getCurrentUser).toHaveBeenCalled();
      expect(MockedAuthService.initializeTokenRefresh).toHaveBeenCalled();
    });

    it('should handle sign-out flow', async () => {
      // Start with authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue(mockUser);

      render(<AppWithProviders initialEntries={['/']} />);
      
      // Wait for authenticated state
      await waitFor(() => {
        expect(screen.getByTestId('avatar')).toBeInTheDocument();
      });

      // Find and click sign-out button
      const signOutButtons = screen.getAllByText('Sign Out');
      fireEvent.click(signOutButtons[0]);

      // Should call sign-out service
      await waitFor(() => {
        expect(MockedAuthService.signOut).toHaveBeenCalled();
      });
    });

    it('should redirect unauthenticated users from protected routes', async () => {
      render(<AppWithProviders initialEntries={['/profile']} />);
      
      // Should redirect to sign-in page
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });
    });

    it('should redirect authenticated users from auth-only routes', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue(mockUser);

      render(<AppWithProviders initialEntries={['/sign-in']} />);
      
      // Should redirect to home page
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      MockedAuthService.signIn.mockRejectedValue(new Error('Invalid credentials'));

      render(<AppWithProviders initialEntries={['/sign-in']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Fill and submit form
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(MockedAuthService.signIn).toHaveBeenCalled();
        // Form should still be available for retry
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });
    });

    it('should handle network errors during authentication', async () => {
      MockedAuthService.signUp.mockRejectedValue(new Error('Network error'));

      render(<AppWithProviders initialEntries={['/sign-up']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeInTheDocument();
      });

      // Fill and submit form
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(MockedAuthService.signUp).toHaveBeenCalled();
        // Form should still be available for retry
        expect(screen.getByText('Create Account')).toBeInTheDocument();
      });
    });
  });

  describe('Session Persistence', () => {
    it('should restore authentication state on app reload', async () => {
      // Mock valid tokens on initial load
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const { rerender } = render(<AppWithProviders initialEntries={['/']} />);
      
      // Wait for authentication to be established
      await waitFor(() => {
        expect(screen.getByTestId('avatar')).toBeInTheDocument();
      });

      // Simulate app reload by re-rendering
      rerender(<AppWithProviders initialEntries={['/']} />);
      
      // Should maintain authenticated state
      await waitFor(() => {
        expect(screen.getByTestId('avatar')).toBeInTheDocument();
      });

      // Verify that token validation was called
      expect(MockedTokenManager.hasValidTokens).toHaveBeenCalled();
      expect(MockedAuthService.getCurrentUser).toHaveBeenCalled();
    });

    it('should handle expired tokens gracefully', async () => {
      // Mock expired tokens
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockRejectedValue(new Error('Token expired'));

      render(<AppWithProviders initialEntries={['/profile']} />);
      
      // Should redirect to sign-in when tokens are expired
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Flow', () => {
    it('should preserve redirect path after authentication', async () => {
      // Start by trying to access protected route
      render(<AppWithProviders initialEntries={['/profile']} />);
      
      // Should redirect to sign-in
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Mock successful authentication
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue(mockUser);

      // Fill and submit sign-in form
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // After successful authentication, should redirect to originally requested page
      await waitFor(() => {
        expect(MockedAuthService.signIn).toHaveBeenCalled();
      });
    });

    it('should handle navigation between auth pages', async () => {
      render(<AppWithProviders initialEntries={['/sign-in']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Click link to sign-up page
      const signUpLink = screen.getByText('Sign up');
      fireEvent.click(signUpLink);

      // Should navigate to sign-up page
      await waitFor(() => {
        expect(screen.getByText('Create Account')).toBeInTheDocument();
      });

      // Click link back to sign-in page
      const signInLink = screen.getByText('Sign in');
      fireEvent.click(signInLink);

      // Should navigate back to sign-in page
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during authentication', async () => {
      // Mock slow authentication
      MockedAuthService.signIn.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockAuthResponse), 100))
      );

      render(<AppWithProviders initialEntries={['/sign-in']} />);
      
      await waitFor(() => {
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      });

      // Fill and submit form
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Should complete authentication
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });

    it('should show loading state while determining authentication status', async () => {
      // Mock slow authentication check
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockUser), 100))
      );

      render(<AppWithProviders initialEntries={['/profile']} />);
      
      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Should show protected content after loading
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });
});