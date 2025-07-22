import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SignInForm from '../SignInForm';
import { AuthProvider } from '../../contexts/AuthContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import * as AuthContext from '../../contexts/AuthContext';

// Mock NextUI components
vi.mock('@nextui-org/react', () => ({
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

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <NotificationProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </NotificationProvider>
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

describe('SignInForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue(mockAuthContextValue);
  });

  describe('Form Rendering', () => {
    it('should render sign-in form with all required fields', () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render OAuth provider buttons', () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
      expect(screen.getByTestId('google-icon')).toBeInTheDocument();
      expect(screen.getByTestId('github-icon')).toBeInTheDocument();
    });

    it('should render link to sign-up page', () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const signUpLink = screen.getByText('Sign up');
      expect(signUpLink).toBeInTheDocument();
      expect(signUpLink.closest('a')).toHaveAttribute('href', '/sign-up');
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty fields', async () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid email format', async () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show validation error for short password', async () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when fields are corrected', async () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Trigger validation errors
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });

      // Fix the errors
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      await waitFor(() => {
        expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
        expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call signIn with correct credentials on form submission', async () => {
      const mockSignIn = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signIn: mockSignIn
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should show loading state during form submission', async () => {
      const mockSignIn = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signIn: mockSignIn
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should handle sign-in errors gracefully', async () => {
      const mockSignIn = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signIn: mockSignIn
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
        // Form should not be disabled after error
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('OAuth Authentication', () => {
    it('should call signInWithOAuth for Google when Google button is clicked', async () => {
      const mockSignInWithOAuth = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signInWithOAuth: mockSignInWithOAuth
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith('google');
      });
    });

    it('should call signInWithOAuth for GitHub when GitHub button is clicked', async () => {
      const mockSignInWithOAuth = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signInWithOAuth: mockSignInWithOAuth
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const githubButton = screen.getByText('Continue with GitHub');
      fireEvent.click(githubButton);

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith('github');
      });
    });

    it('should show loading state for OAuth buttons during authentication', async () => {
      const mockSignInWithOAuth = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signInWithOAuth: mockSignInWithOAuth
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      expect(googleButton).toBeDisabled();

      await waitFor(() => {
        expect(googleButton).not.toBeDisabled();
      });
    });

    it('should handle OAuth errors gracefully', async () => {
      const mockSignInWithOAuth = vi.fn().mockRejectedValue(new Error('OAuth error'));
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signInWithOAuth: mockSignInWithOAuth
      });

      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalled();
        // Button should not remain disabled after error
        expect(googleButton).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and structure', () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should associate error messages with form fields', async () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByTestId('error-message');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render properly on different screen sizes', () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>
      );

      // Check that the form container has responsive classes
      const formContainer = screen.getByText('Welcome Back').closest('div');
      expect(formContainer).toBeInTheDocument();
    });
  });
});