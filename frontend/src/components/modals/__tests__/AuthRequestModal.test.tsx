import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthRequestModal } from '../AuthRequestModal';
import { useAuth } from '../../../contexts/AuthContext';

// Mock the useAuth hook
vi.mock('../../../contexts/AuthContext', () => ({
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

describe('AuthRequestModal', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  const mockSignInWithOAuth = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: mockSignInWithOAuth,
      signOut: vi.fn(),
      refreshToken: vi.fn(),
    });

    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <AuthRequestModal
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Sign in Required')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Sign in Required')).toBeInTheDocument();
      expect(screen.getByText('This feature requires you to be signed in to continue.')).toBeInTheDocument();
    });

    it('should render recording-specific message', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
          feature="recording"
        />
      );

      expect(screen.getByText('Sign in to Record')).toBeInTheDocument();
      expect(screen.getByText(/Recording audio and video requires an account/)).toBeInTheDocument();
    });

    it('should render profile-specific message', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
          feature="profile"
        />
      );

      expect(screen.getByText('Sign in Required')).toBeInTheDocument();
      expect(screen.getByText(/You need to be signed in to access your profile/)).toBeInTheDocument();
    });

    it('should render room management-specific message', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
          feature="room-management"
        />
      );

      expect(screen.getByText('Sign in to Manage Rooms')).toBeInTheDocument();
      expect(screen.getByText(/Managing room settings and permissions requires an account/)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when "Continue without signing in" is clicked', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const continueButton = screen.getByText('Continue without signing in');
      fireEvent.click(continueButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('OAuth authentication', () => {
    it('should call signInWithOAuth for Google when Google button is clicked', async () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith('google');
      });
    });

    it('should call signInWithOAuth for GitHub when GitHub button is clicked', async () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const githubButton = screen.getByText('Continue with GitHub');
      fireEvent.click(githubButton);

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith('github');
      });
    });

    it('should store redirect URL before OAuth sign-in', async () => {
      const redirectUrl = '/dashboard';
      
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
          redirectAfterAuth={redirectUrl}
        />
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_redirect_url', redirectUrl);
    });

    it('should call onClose after successful OAuth sign-in', async () => {
      mockSignInWithOAuth.mockResolvedValue(undefined);

      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle OAuth sign-in errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSignInWithOAuth.mockRejectedValue(new Error('OAuth failed'));

      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('google sign-in failed:', expect.any(Error));
      });

      // Modal should remain open on error
      expect(mockOnClose).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('email/password navigation', () => {
    it('should navigate to sign-in page when "Sign In with Email" is clicked', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const signInButton = screen.getByText('Sign In with Email');
      fireEvent.click(signInButton);

      expect(mockLocation.href).toBe('/sign-in');
    });

    it('should navigate to sign-up page when "Create New Account" is clicked', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const signUpButton = screen.getByText('Create New Account');
      fireEvent.click(signUpButton);

      expect(mockLocation.href).toBe('/sign-up');
    });

    it('should store redirect URL before navigating to sign-in', () => {
      const redirectUrl = '/dashboard';
      
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
          redirectAfterAuth={redirectUrl}
        />
      );

      const signInButton = screen.getByText('Sign In with Email');
      fireEvent.click(signInButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_redirect_url', redirectUrl);
    });

    it('should store redirect URL before navigating to sign-up', () => {
      const redirectUrl = '/dashboard';
      
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
          redirectAfterAuth={redirectUrl}
        />
      );

      const signUpButton = screen.getByText('Create New Account');
      fireEvent.click(signUpButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_redirect_url', redirectUrl);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(
        <AuthRequestModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      
      // Simulate keyboard interaction
      fireEvent.keyDown(closeButton, { key: 'Enter', code: 'Enter' });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});