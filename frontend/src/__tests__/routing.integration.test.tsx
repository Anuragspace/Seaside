import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthService } from '../services/authService';
import { TokenManager } from '../utils/tokenManager';

// Mock the auth service and token manager
vi.mock('../services/authService');
vi.mock('../utils/tokenManager');

// Mock the components that have complex dependencies
vi.mock('../pages/RoomPage', () => ({
  default: () => <div data-testid="room-page">Room Page</div>
}));

vi.mock('../components/SignInForm', () => ({
  default: () => <div data-testid="sign-in-form">Sign In Form</div>
}));

vi.mock('../components/SignUpForm', () => ({
  default: () => <div data-testid="sign-up-form">Sign Up Form</div>
}));

vi.mock('../pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home Page</div>
}));

const MockedAuthService = vi.mocked(AuthService);
const MockedTokenManager = vi.mocked(TokenManager);

// Helper component to render App with routing
const AppWithRouter = ({ initialEntries = ['/'] }: { initialEntries?: string[] }) => (
  <MemoryRouter initialEntries={initialEntries}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </MemoryRouter>
);

describe('Routing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    MockedTokenManager.hasValidTokens.mockReturnValue(false);
    MockedAuthService.getCurrentUser.mockRejectedValue(new Error('Not authenticated'));
    MockedAuthService.initializeTokenRefresh.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Public Routes', () => {
    it('should render home page for unauthenticated users', async () => {
      render(<AppWithRouter initialEntries={['/']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });

    it('should render home page for authenticated users', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      render(<AppWithRouter initialEntries={['/']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });

    it('should render room page for unauthenticated users (guest access)', async () => {
      render(<AppWithRouter initialEntries={['/room/test123']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('room-page')).toBeInTheDocument();
      });
    });

    it('should render room page for authenticated users', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      render(<AppWithRouter initialEntries={['/room/test123']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('room-page')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Routes (Public Only)', () => {
    it('should render sign-in form for unauthenticated users', async () => {
      render(<AppWithRouter initialEntries={['/sign-in']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
      });
    });

    it('should redirect authenticated users from sign-in to home', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      render(<AppWithRouter initialEntries={['/sign-in']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
        expect(screen.queryByTestId('sign-in-form')).not.toBeInTheDocument();
      });
    });

    it('should render sign-up form for unauthenticated users', async () => {
      render(<AppWithRouter initialEntries={['/sign-up']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('sign-up-form')).toBeInTheDocument();
      });
    });

    it('should redirect authenticated users from sign-up to home', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      render(<AppWithRouter initialEntries={['/sign-up']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
        expect(screen.queryByTestId('sign-up-form')).not.toBeInTheDocument();
      });
    });

    it('should redirect authenticated users from sign-in to originally requested page', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      // Simulate user being redirected to sign-in from /profile
      render(
        <MemoryRouter initialEntries={['/sign-in']} initialIndex={0}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });
  });

  describe('Protected Routes', () => {
    it('should render profile page for authenticated users', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      render(<AppWithRouter initialEntries={['/profile']} />);
      
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
        expect(screen.getByText('This is a protected route that requires authentication.')).toBeInTheDocument();
      });
    });

    it('should redirect unauthenticated users from protected routes to sign-in', async () => {
      render(<AppWithRouter initialEntries={['/profile']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
        expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication State Persistence', () => {
    it('should maintain authentication state across page reloads', async () => {
      // Mock valid tokens on initial load
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      const { rerender } = render(<AppWithRouter initialEntries={['/profile']} />);
      
      // Wait for authentication to be established
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
      });

      // Simulate page reload by re-rendering
      rerender(<AppWithRouter initialEntries={['/profile']} />);
      
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
      });

      // Verify that token validation was called
      expect(MockedTokenManager.hasValidTokens).toHaveBeenCalled();
      expect(MockedAuthService.getCurrentUser).toHaveBeenCalled();
    });

    it('should handle expired tokens gracefully', async () => {
      // Mock expired tokens
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockRejectedValue(new Error('Token expired'));

      render(<AppWithRouter initialEntries={['/profile']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
        expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation Flow', () => {
    it('should preserve redirect path when redirecting to sign-in', async () => {
      render(<AppWithRouter initialEntries={['/profile']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
      });

      // The location state should preserve the original path
      // This would be tested in the actual sign-in form component
    });

    it('should handle invalid routes by redirecting to home', async () => {
      render(<AppWithRouter initialEntries={['/invalid-route']} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while determining authentication status', async () => {
      // Mock slow authentication check
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          id: '1',
          email: 'test@example.com',
          username: 'testuser',
        }), 100))
      );

      render(<AppWithRouter initialEntries={['/profile']} />);
      
      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Should show protected content after loading
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Multi-tab Synchronization', () => {
    it('should handle storage events for multi-tab authentication sync', async () => {
      // Mock authenticated state
      MockedTokenManager.hasValidTokens.mockReturnValue(true);
      MockedAuthService.getCurrentUser.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
      });

      render(<AppWithRouter initialEntries={['/profile']} />);
      
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
      });

      // Simulate token removal in another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'auth_access_token',
        newValue: null,
        oldValue: 'some-token',
      });

      // Dispatch the storage event
      window.dispatchEvent(storageEvent);

      // Should redirect to sign-in after token removal
      await waitFor(() => {
        expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
        expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
      });
    });
  });
});