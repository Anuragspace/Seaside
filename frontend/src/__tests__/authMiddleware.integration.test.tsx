import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { useAuthMiddleware } from '../hooks/useAuthMiddleware';
import { AuthRequestModal } from '../components/modals/AuthRequestModal';
import * as AuthContext from '../contexts/AuthContext';

// Mock NextUI components
vi.mock('@nextui-org/react', () => ({
  Modal: ({ children, isOpen, onOpenChange }: any) => 
    isOpen ? <div data-testid="modal" onClick={() => onOpenChange(false)}>{children}</div> : null,
  ModalContent: ({ children }: any) => <div data-testid="modal-content">{children}</div>,
  ModalHeader: ({ children }: any) => <div data-testid="modal-header">{children}</div>,
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalFooter: ({ children }: any) => <div data-testid="modal-footer">{children}</div>,
  Button: ({ children, onPress, color, variant, ...props }: any) => (
    <button onClick={onPress} data-testid={`button-${color || 'default'}`} {...props}>
      {children}
    </button>
  ),
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardBody: ({ children }: any) => <div>{children}</div>,
}));

// Mock react-icons
vi.mock('react-icons/fa', () => ({
  FaGoogle: () => <div data-testid="google-icon" />,
  FaGithub: () => <div data-testid="github-icon" />,
}));

vi.mock('lucide-react', () => ({
  Lock: () => <div data-testid="lock-icon" />,
  User: () => <div data-testid="user-icon" />,
}));

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

// Test component that uses auth middleware
const TestComponentWithMiddleware = ({ 
  requireAuth = true, 
  feature = 'test-feature',
  onAuthRequired,
  onCanAccess 
}: {
  requireAuth?: boolean;
  feature?: string;
  onAuthRequired?: () => void;
  onCanAccess?: (canAccess: boolean) => void;
}) => {
  const { canAccess, requestAuth } = useAuthMiddleware({
    requireAuth,
    feature,
    onAuthRequired
  });

  React.useEffect(() => {
    onCanAccess?.(canAccess);
  }, [canAccess, onCanAccess]);

  return (
    <div>
      <div data-testid="can-access">{canAccess.toString()}</div>
      <button onClick={requestAuth} data-testid="request-auth">
        Request Auth
      </button>
      {canAccess ? (
        <div data-testid="protected-content">Protected Content</div>
      ) : (
        <div data-testid="auth-required">Authentication Required</div>
      )}
    </div>
  );
};

// Test component for recording features
const RecordingComponent = () => {
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const { canAccess: canRecord, requestAuth } = useAuthMiddleware({
    requireAuth: true,
    feature: 'recording',
    onAuthRequired: () => setShowAuthModal(true)
  });

  const handleStartRecording = () => {
    if (canRecord) {
      // Start recording
      console.log('Recording started');
    } else {
      requestAuth();
    }
  };

  return (
    <div>
      <button onClick={handleStartRecording} data-testid="start-recording">
        Start Recording
      </button>
      {canRecord && <div data-testid="recording-controls">Recording Controls</div>}
      
      <AuthRequestModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        feature="recording"
        message="Authentication is required to record audio and video."
      />
    </div>
  );
};

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

describe('Authentication Middleware Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAuthMiddleware Hook', () => {
    it('should allow access when user is authenticated and auth is required', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com', username: 'testuser' }
      });

      let canAccessResult: boolean | undefined;

      render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={true}
            onCanAccess={(canAccess) => { canAccessResult = canAccess; }}
          />
        </TestWrapper>
      );

      expect(canAccessResult).toBe(true);
      expect(screen.getByTestId('can-access')).toHaveTextContent('true');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should deny access when user is not authenticated and auth is required', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      let canAccessResult: boolean | undefined;

      render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={true}
            onCanAccess={(canAccess) => { canAccessResult = canAccess; }}
          />
        </TestWrapper>
      );

      expect(canAccessResult).toBe(false);
      expect(screen.getByTestId('can-access')).toHaveTextContent('false');
      expect(screen.getByTestId('auth-required')).toBeInTheDocument();
    });

    it('should allow access when auth is not required regardless of authentication status', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      let canAccessResult: boolean | undefined;

      render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={false}
            onCanAccess={(canAccess) => { canAccessResult = canAccess; }}
          />
        </TestWrapper>
      );

      expect(canAccessResult).toBe(true);
      expect(screen.getByTestId('can-access')).toHaveTextContent('true');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should call onAuthRequired when requestAuth is called and user is not authenticated', () => {
      const mockOnAuthRequired = vi.fn();
      
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={true}
            onAuthRequired={mockOnAuthRequired}
          />
        </TestWrapper>
      );

      const requestAuthButton = screen.getByTestId('request-auth');
      fireEvent.click(requestAuthButton);

      expect(mockOnAuthRequired).toHaveBeenCalled();
    });

    it('should not call onAuthRequired when requestAuth is called and user is authenticated', () => {
      const mockOnAuthRequired = vi.fn();
      
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com', username: 'testuser' }
      });

      render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={true}
            onAuthRequired={mockOnAuthRequired}
          />
        </TestWrapper>
      );

      const requestAuthButton = screen.getByTestId('request-auth');
      fireEvent.click(requestAuthButton);

      expect(mockOnAuthRequired).not.toHaveBeenCalled();
    });
  });

  describe('Recording Authentication Requirements', () => {
    it('should show recording controls when user is authenticated', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com', username: 'testuser' }
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('recording-controls')).toBeInTheDocument();
    });

    it('should show authentication modal when unauthenticated user tries to record', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      expect(screen.queryByTestId('recording-controls')).not.toBeInTheDocument();

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Authentication Required')).toBeInTheDocument();
        expect(screen.getByText('Authentication is required to record audio and video.')).toBeInTheDocument();
      });
    });

    it('should allow recording immediately when authenticated user clicks record', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com', username: 'testuser' }
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      expect(consoleSpy).toHaveBeenCalledWith('Recording started');
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('AuthRequestModal Integration', () => {
    it('should render authentication modal with correct content', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
        expect(screen.getByText('Authentication Required')).toBeInTheDocument();
        expect(screen.getByText('Authentication is required to record audio and video.')).toBeInTheDocument();
        expect(screen.getByText('Sign In')).toBeInTheDocument();
        expect(screen.getByText('Sign Up')).toBeInTheDocument();
        expect(screen.getByText('Continue with Google')).toBeInTheDocument();
        expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
      });
    });

    it('should close authentication modal when close button is clicked', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Cancel');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });

    it('should handle OAuth authentication from modal', async () => {
      const mockSignInWithOAuth = vi.fn().mockResolvedValue(undefined);
      
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false,
        signInWithOAuth: mockSignInWithOAuth
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith('google');
      });
    });

    it('should navigate to sign-in page from modal', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      const signInButton = screen.getByText('Sign In');
      expect(signInButton.closest('a')).toHaveAttribute('href', '/sign-in');
    });

    it('should navigate to sign-up page from modal', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      const signUpButton = screen.getByText('Sign Up');
      expect(signUpButton.closest('a')).toHaveAttribute('href', '/sign-up');
    });
  });

  describe('Feature-Specific Authentication', () => {
    it('should handle different features with different auth requirements', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      const { rerender } = render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={true}
            feature="recording"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('can-access')).toHaveTextContent('false');

      rerender(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={false}
            feature="chat"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('can-access')).toHaveTextContent('true');
    });

    it('should handle room creation with guest access', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={false}
            feature="room-creation"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('can-access')).toHaveTextContent('true');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should handle room joining with guest access', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false
      });

      render(
        <TestWrapper>
          <TestComponentWithMiddleware 
            requireAuth={false}
            feature="room-joining"
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('can-access')).toHaveTextContent('true');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Authentication State Changes', () => {
    it('should update access when authentication state changes', async () => {
      const mockAuthContext = {
        ...mockAuthContextValue,
        isAuthenticated: false
      };

      const { rerender } = render(
        <TestWrapper>
          <TestComponentWithMiddleware requireAuth={true} />
        </TestWrapper>
      );

      // Initially not authenticated
      expect(screen.getByTestId('can-access')).toHaveTextContent('false');
      expect(screen.getByTestId('auth-required')).toBeInTheDocument();

      // Mock authentication
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContext,
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com', username: 'testuser' }
      });

      rerender(
        <TestWrapper>
          <TestComponentWithMiddleware requireAuth={true} />
        </TestWrapper>
      );

      // Now authenticated
      expect(screen.getByTestId('can-access')).toHaveTextContent('true');
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should handle loading state during authentication check', () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isLoading: true
      });

      render(
        <TestWrapper>
          <TestComponentWithMiddleware requireAuth={true} />
        </TestWrapper>
      );

      // Should deny access during loading for security
      expect(screen.getByTestId('can-access')).toHaveTextContent('false');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const mockSignInWithOAuth = vi.fn().mockRejectedValue(new Error('OAuth error'));
      
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        ...mockAuthContextValue,
        isAuthenticated: false,
        signInWithOAuth: mockSignInWithOAuth
      });

      render(
        <TestWrapper>
          <RecordingComponent />
        </TestWrapper>
      );

      const startRecordingButton = screen.getByTestId('start-recording');
      fireEvent.click(startRecordingButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      const googleButton = screen.getByText('Continue with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalled();
        // Modal should still be open after error
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });
    });

    it('should handle missing auth context gracefully', () => {
      // Mock missing auth context
      vi.spyOn(AuthContext, 'useAuth').mockImplementation(() => {
        throw new Error('useAuth must be used within an AuthProvider');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <TestComponentWithMiddleware requireAuth={true} />
        );
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});