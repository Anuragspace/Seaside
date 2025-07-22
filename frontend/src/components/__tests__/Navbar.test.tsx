import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Navbar from '../Navbar';
import { AuthProvider } from '../../contexts/AuthContext';
import * as AuthContext from '../../contexts/AuthContext';

// Mock the useTimeOfDay hook
vi.mock('../../hooks/useTimeOfDay', () => ({
  useTimeOfDay: () => ({ isDay: true })
}));

// Mock date-fns format function
vi.mock('date-fns', () => ({
  format: () => 'Monday 1st January'
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Moon: () => <div data-testid="moon-icon" />,
  Sun: () => <div data-testid="sun-icon" />,
  User: () => <div data-testid="user-icon" />,
  X: () => <div data-testid="x-icon" />,
  Menu: () => <div data-testid="menu-icon" />,
  LogOut: () => <div data-testid="logout-icon" />
}));

// Mock NextUI components
vi.mock('@nextui-org/react', () => ({
  Avatar: ({ name, children, fallback, className, ...props }: any) => (
    <div data-testid="avatar" className={className} data-name={name} {...props}>
      {name || children || fallback}
    </div>
  ),
  Button: ({ children, onPress, className, ...props }: any) => (
    <button 
      data-testid="button" 
      className={className} 
      onClick={onPress}
      {...props}
    >
      {children}
    </button>
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

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

// Mock auth context values
const mockAuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  refreshToken: vi.fn()
};

describe('Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false,
        isLoading: false
      });
    });

    it('should display sign-in and sign-up buttons for unauthenticated users on desktop', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Check for sign-in and sign-up buttons in desktop view
      const signInButtons = screen.getAllByText('Sign In');
      const signUpButtons = screen.getAllByText('Sign Up');
      
      expect(signInButtons.length).toBeGreaterThan(0);
      expect(signUpButtons.length).toBeGreaterThan(0);
    });

    it('should not display user avatar in mobile menu trigger when unauthenticated', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Mobile menu should not show avatar for unauthenticated users
      const avatars = screen.queryAllByTestId('avatar');
      // Should only have avatars in the mobile menu content, not in the trigger area
      expect(avatars.length).toBe(0);
    });

    it('should show sign-in and sign-up buttons in mobile menu when opened', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Open mobile menu
      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      // Check for sign-in and sign-up buttons in mobile menu
      const signInButtons = screen.getAllByText('Sign In');
      const signUpButtons = screen.getAllByText('Sign Up');
      
      expect(signInButtons.length).toBeGreaterThan(0);
      expect(signUpButtons.length).toBeGreaterThan(0);
    });

    it('should navigate to sign-in page when sign-in button is clicked', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      const signInButton = screen.getAllByText('Sign In')[0];
      expect(signInButton.closest('a')).toHaveAttribute('href', '/sign-in');
    });

    it('should navigate to sign-up page when sign-up button is clicked', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      const signUpButton = screen.getAllByText('Sign Up')[0];
      expect(signUpButton.closest('a')).toHaveAttribute('href', '/sign-up');
    });
  });

  describe('Authenticated State', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      avatar: 'https://example.com/avatar.jpg',
      provider: 'email' as const
    };

    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        user: mockUser,
        isAuthenticated: true,
        isLoading: false
      });
    });

    it('should display user avatar and profile dropdown for authenticated users on desktop', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Should show user avatar
      const avatars = screen.getAllByTestId('avatar');
      expect(avatars.length).toBeGreaterThan(0);

      // Should show dropdown
      expect(screen.getByTestId('dropdown')).toBeInTheDocument();
    });

    it('should display user profile information in dropdown menu', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Check for user email in dropdown - use getAllByText since it appears in both desktop and mobile
      const emailElements = screen.getAllByText('test@example.com');
      expect(emailElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Signed in as')).toBeInTheDocument();
    });

    it('should display sign-out option in dropdown menu', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      const signOutElements = screen.getAllByText('Sign Out');
      expect(signOutElements.length).toBeGreaterThan(0);
    });

    it('should display user avatar in mobile menu trigger when authenticated', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Should show avatar in mobile menu trigger area
      const avatars = screen.getAllByTestId('avatar');
      expect(avatars.length).toBeGreaterThan(0);
    });

    it('should show user profile and sign-out in mobile menu when opened', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Open mobile menu
      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      // Check for user info in mobile menu
      expect(screen.getByText('testuser')).toBeInTheDocument();
      const emailElements = screen.getAllByText('test@example.com');
      expect(emailElements.length).toBeGreaterThan(0);
      const signOutElements = screen.getAllByText('Sign Out');
      expect(signOutElements.length).toBeGreaterThan(0);
    });

    it('should not display sign-in/sign-up buttons when authenticated', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Should not show sign-in/sign-up buttons
      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
    });

    it('should call signOut when sign-out is clicked', async () => {
      const mockSignOut = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        signOut: mockSignOut
      });

      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      const signOutButtons = screen.getAllByText('Sign Out');
      fireEvent.click(signOutButtons[0]);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });

    it('should show dashboard button when not on homepage', () => {
      // Mock window.location.pathname
      Object.defineProperty(window, 'location', {
        value: { pathname: '/some-other-page' },
        writable: true
      });

      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      const dashboardButtons = screen.getAllByText('Dashboard');
      expect(dashboardButtons.length).toBeGreaterThan(0);
    });

    it('should not show dashboard button when on homepage', () => {
      // Mock window.location.pathname
      Object.defineProperty(window, 'location', {
        value: { pathname: '/' },
        writable: true
      });

      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isLoading: true
      });
    });

    it('should not display sign-in/sign-up buttons when loading', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Should not show sign-in/sign-up buttons while loading
      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
    });
  });

  describe('Mobile Menu Functionality', () => {
    beforeEach(() => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false,
        isLoading: false
      });
    });

    it('should toggle mobile menu when menu button is clicked', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    });

    it('should close mobile menu when close button is clicked', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Open menu
      const openButton = screen.getByLabelText('Open menu');
      fireEvent.click(openButton);

      // Close menu
      const closeButton = screen.getByLabelText('Close menu');
      fireEvent.click(closeButton);

      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('should close mobile menu when navigation link is clicked', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Open menu
      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      // Verify menu is open
      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();

      // Click sign-in button (should close menu)
      const signInButtons = screen.getAllByText('Sign In');
      const mobileSignInButton = signInButtons.find(btn => 
        btn.closest('.w-full')
      );
      fireEvent.click(mobileSignInButton!);

      // Menu should close (button text changes back to "Open menu")
      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should show desktop navigation elements on larger screens', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Desktop elements should have appropriate classes
      const signInButtons = screen.getAllByText('Sign In');
      const desktopSignInButton = signInButtons[0]; // First one should be desktop
      const desktopNav = desktopSignInButton.closest('.hidden');
      expect(desktopNav).toBeInTheDocument();
    });

    it('should show mobile menu trigger on smaller screens', () => {
      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Mobile menu trigger should have appropriate classes
      const mobileMenuTrigger = screen.getByLabelText('Open menu').closest('.md\\:hidden');
      expect(mobileMenuTrigger).toBeInTheDocument();
    });
  });

  describe('User Details Processing', () => {
    it('should generate correct initials from username', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'John Doe',
        provider: 'email' as const
      };

      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        user: mockUser,
        isAuthenticated: true,
        isLoading: false
      });

      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Should generate "JD" initials from "John Doe"
      const avatar = screen.getAllByTestId('avatar')[0];
      expect(avatar).toHaveTextContent('JD');
    });

    it('should handle single word username for initials', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        provider: 'email' as const
      };

      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        user: mockUser,
        isAuthenticated: true,
        isLoading: false
      });

      render(
        <TestWrapper>
          <Navbar />
        </TestWrapper>
      );

      // Should generate "T" initial from "testuser"
      const avatar = screen.getAllByTestId('avatar')[0];
      expect(avatar).toHaveTextContent('T');
    });
  });
});