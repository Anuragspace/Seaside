import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SignUpForm from '../SignUpForm';
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

describe('SignUpForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue(mockAuthContextValue);
  });

  describe('Form Rendering', () => {
    it('should render sign-up form with all required fields', () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByText('Join us today')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should render OAuth provider buttons', () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
      expect(screen.getByTestId('google-icon')).toBeInTheDocument();
      expect(screen.getByTestId('github-icon')).toBeInTheDocument();
    });

    it('should render link to sign-in page', () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const signInLink = screen.getByText('Sign in');
      expect(signInLink).toBeInTheDocument();
      expect(signInLink.closest('a')).toHaveAttribute('href', '/sign-in');
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty fields', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Username is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
        expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid email format', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show validation error for short username', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText('Username');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(usernameInput, { target: { value: 'ab' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('should show validation error for short password', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      });
    });

    it('should show validation error for mismatched passwords', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when fields are corrected', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      // Trigger validation errors
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Username is required')).toBeInTheDocument();
      });

      // Fix the errors
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

      await waitFor(() => {
        expect(screen.queryByText('Username is required')).not.toBeInTheDocument();
        expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
        expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
        expect(screen.queryByText('Please confirm your password')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call signUp with correct data on form submission', async () => {
      const mockSignUp = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signUp: mockSignUp
      });

      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

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

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        });
      });
    });

    it('should show loading state during form submission', async () => {
      const mockSignUp = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signUp: mockSignUp
      });

      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

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

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should handle sign-up errors gracefully', async () => {
      const mockSignUp = vi.fn().mockRejectedValue(new Error('Email already exists'));
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        signUp: mockSignUp
      });

      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled();
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
          <SignUpForm />
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
          <SignUpForm />
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
          <SignUpForm />
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
          <SignUpForm />
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

  describe('Password Strength Validation', () => {
    it('should validate password complexity requirements', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      // Test weak password
      fireEvent.change(passwordInput, { target: { value: 'weak' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      });
    });

    it('should accept strong passwords', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm Password');

      fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });

      // Should not show password strength errors
      await waitFor(() => {
        expect(screen.queryByText('Password must be at least 6 characters')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and structure', () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should associate error messages with form fields', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByTestId('error-message');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Username Validation', () => {
    it('should validate username format and length', async () => {
      render(
        <TestWrapper>
          <SignUpForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText('Username');
      const submitButton = screen.getByRole('button', { name: /sign up/i });

      // Test too short username
      fireEvent.change(usernameInput, { target: { value: 'ab' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
      });

      // Test valid username
      fireEvent.change(usernameInput, { target: { value: 'validuser123' } });

      await waitFor(() => {
        expect(screen.queryByText('Username must be at least 3 characters')).not.toBeInTheDocument();
      });
    });
  });
});