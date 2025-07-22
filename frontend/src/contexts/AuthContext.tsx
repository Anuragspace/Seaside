import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { AuthService, AuthError } from '../services/authService';
import { TokenManager } from '../utils/tokenManager';
import { sessionManager } from '../utils/sessionManager';
import { useNotifications } from './NotificationContext';
import { ErrorService } from '../services/errorService';

// User interface
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  provider?: 'email' | 'google' | 'github';
}

// Authentication data interfaces
export interface SignInData {
  email: string;
  password: string;
}

export interface SignUpData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Authentication response interface
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// OAuth2 configuration interface
export interface OAuth2Config {
  google: {
    clientId: string;
    redirectUri: string;
    scope: string[];
  };
  github: {
    clientId: string;
    redirectUri: string;
    scope: string[];
  };
}

// Authentication context type
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (credentials: SignInData) => Promise<void>;
  signUp: (userData: SignUpData) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<void>;
  handleOAuth2Callback: (provider: 'google' | 'github', callbackUrl: string) => Promise<void>;
  authError: Error | null;
}

// Auth state interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: Error | null;
}

// Auth actions
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'CLEAR_USER' }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_AUTH_ERROR'; payload: Error | null }
  | { type: 'INITIALIZE_AUTH'; payload: { user: User | null; isAuthenticated: boolean } };

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      };
    case 'CLEAR_USER':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_AUTH_ERROR':
      return { ...state, authError: action.payload, isLoading: false };
    case 'INITIALIZE_AUTH':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: action.payload.isAuthenticated,
        isLoading: false,
        authError: null,
      };
    default:
      return state;
  }
};

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { showError, showSuccess } = useNotifications();

  // Process and display authentication errors
  const processAuthError = useCallback((error: Error | AuthError, context?: any) => {
    // Set auth error in state
    dispatch({ type: 'SET_AUTH_ERROR', payload: error });

    // Process error through error service
    const errorContext = {
      ...context,
      feature: 'authentication',
      userId: state.user?.id,
    };

    // Show error notification
    showError(error, errorContext);

    // Return the error for further handling
    return error;
  }, [showError, state.user?.id]);

  // Initialize authentication state
  const initializeAuth = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Initialize session manager
      sessionManager.initialize();

      // Temporarily disable session timeout for debugging
      console.log('Session manager state:', {
        isActive: sessionManager.isSessionActive(),
        isTimedOut: sessionManager.isSessionTimedOut(),
        sessionInfo: sessionManager.getSessionInfo()
      });

      // Check if user has valid tokens and active session
      const hasValidTokens = TokenManager.hasValidTokens();
      const isSessionActive = sessionManager.isSessionActive();

      console.log('Auth initialization check:', {
        hasValidTokens,
        isSessionActive,
        accessToken: localStorage.getItem('auth_access_token'),
        refreshToken: localStorage.getItem('auth_refresh_token')
      });

      if (hasValidTokens) {
        try {
          // Try to get current user info
          const user = await AuthService.getCurrentUser();

          dispatch({
            type: 'INITIALIZE_AUTH',
            payload: { user, isAuthenticated: true }
          });

          // Initialize automatic token refresh
          AuthService.initializeTokenRefresh();

          // Start or renew session
          if (!isSessionActive) {
            sessionManager.startSession();
          } else {
            sessionManager.renewSession();
          }
        } catch (error) {
          // If getting user info fails, clear tokens and end session
          console.warn('Failed to get user info during initialization:', error);
          TokenManager.clearTokens();
          sessionManager.endSession();
          dispatch({
            type: 'INITIALIZE_AUTH',
            payload: { user: null, isAuthenticated: false }
          });
        }
      } else {
        // No valid tokens or session, user is not authenticated
        TokenManager.clearTokens();
        sessionManager.endSession();
        dispatch({
          type: 'INITIALIZE_AUTH',
          payload: { user: null, isAuthenticated: false }
        });
      }
    } catch (error) {
      const authError = error instanceof Error ? error : new Error('Unknown error during auth initialization');
      processAuthError(authError, { action: 'initialize_auth' });

      dispatch({
        type: 'INITIALIZE_AUTH',
        payload: { user: null, isAuthenticated: false }
      });
    }
  }, [processAuthError]);

  // Sign in with email and password
  const signIn = useCallback(async (credentials: SignInData): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const response = await AuthService.signIn(credentials);

      dispatch({ type: 'SET_USER', payload: response.user });

      // Start new session
      sessionManager.startSession();

      // Initialize automatic token refresh
      AuthService.initializeTokenRefresh();

      // Show success notification
      showSuccess('Successfully signed in');
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });

      const authError = error instanceof Error ? error :
        new AuthError('Sign in failed. Please try again.');

      processAuthError(authError, {
        action: 'sign_in',
        email: credentials.email
      });

      throw authError;
    }
  }, [processAuthError, showSuccess]);

  // Sign up with user data
  const signUp = useCallback(async (userData: SignUpData): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const response = await AuthService.signUp(userData);



      dispatch({ type: 'SET_USER', payload: response.user });

      // Start new session
      sessionManager.startSession();

      // Initialize automatic token refresh
      AuthService.initializeTokenRefresh();

      // Show success notification
      showSuccess('Account created successfully');
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });

      const authError = error instanceof Error ? error :
        new AuthError('Sign up failed. Please try again.');

      processAuthError(authError, {
        action: 'sign_up',
        email: userData.email
      });

      throw authError;
    }
  }, [processAuthError, showSuccess]);

  // Sign in with OAuth2 provider
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github'): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Initiate OAuth2 flow (redirects to provider)
      AuthService.initiateOAuth2Flow(provider);

      // Note: The actual authentication completion happens in the OAuth2 callback handler
      // This function primarily initiates the flow
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });

      const authError = error instanceof Error ? error :
        new AuthError(`${provider} authentication failed. Please try again.`);

      processAuthError(authError, {
        action: 'oauth_initiate',
        provider
      });

      throw authError;
    }
  }, [processAuthError]);

  // Sign out user
  const signOut = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      await AuthService.signOut();

      // End session and cleanup
      sessionManager.endSession();

      dispatch({ type: 'CLEAR_USER' });
    } catch (error) {
      // Even if server sign-out fails, clear local state and end session
      sessionManager.endSession();
      dispatch({ type: 'CLEAR_USER' });

      // Log error but don't show to user - sign out should always appear successful
      console.warn('Sign out error:', error);

      // Process error for monitoring but don't show to user
      ErrorService.processError(
        error instanceof Error ? error : new Error('Sign out failed'),
        { action: 'sign_out' }
      );
    }
  }, []);

  // Refresh authentication tokens
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      const response = await AuthService.refreshToken();

      // Update user info if it changed
      if (response.user) {
        dispatch({ type: 'SET_USER', payload: response.user });
      }
    } catch (error) {
      // If refresh fails, clear user state
      dispatch({ type: 'CLEAR_USER' });

      const authError = error instanceof Error ? error :
        new AuthError('Token refresh failed. Please sign in again.');

      processAuthError(authError, { action: 'refresh_token' });

      throw authError;
    }
  }, [processAuthError]);

  // Handle OAuth2 callback
  const handleOAuth2Callback = useCallback(async (
    provider: 'google' | 'github',
    callbackUrl: string
  ): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const response = await AuthService.handleOAuth2Callback(provider, callbackUrl);

      dispatch({ type: 'SET_USER', payload: response.user });

      // Start new session
      sessionManager.startSession();

      // Initialize automatic token refresh
      AuthService.initializeTokenRefresh();

      // Show success notification
      showSuccess(`Successfully signed in with ${provider}`);
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });

      const authError = error instanceof Error ? error :
        new AuthError(`${provider} authentication failed. Please try again.`);

      processAuthError(authError, {
        action: 'oauth_callback',
        provider,
        callbackUrl
      });

      throw authError;
    }
  }, [processAuthError, showSuccess]);

  // Initialize authentication state on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Setup session event listeners
  useEffect(() => {
    const handleSessionExpired = () => {
      dispatch({ type: 'CLEAR_USER' });
      showError(new Error('Your session has expired. Please sign in again.'));
    };

    const handleSessionTimeout = () => {
      dispatch({ type: 'CLEAR_USER' });
      showError(new Error('Your session timed out due to inactivity. Please sign in again.'));
    };

    const handleSessionCleanup = () => {
      dispatch({ type: 'CLEAR_USER' });
    };

    // Add session event listeners
    sessionManager.addEventListener('session_expired', handleSessionExpired);
    sessionManager.addEventListener('session_timeout', handleSessionTimeout);
    sessionManager.addEventListener('session_cleanup', handleSessionCleanup);

    return () => {
      // Remove session event listeners
      sessionManager.removeEventListener('session_expired', handleSessionExpired);
      sessionManager.removeEventListener('session_timeout', handleSessionTimeout);
      sessionManager.removeEventListener('session_cleanup', handleSessionCleanup);
    };
  }, [showError]);

  // Listen for storage changes (for multi-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // If tokens were cleared in another tab, update auth state
      if (event.key === 'auth_access_token' && !event.newValue) {
        dispatch({ type: 'CLEAR_USER' });
      }
      // If tokens were set in another tab, reinitialize auth
      else if (event.key === 'auth_access_token' && event.newValue) {
        initializeAuth();
      }
      // Handle session changes from other tabs
      else if (event.key === 'auth_session_id') {
        if (!event.newValue) {
          // Session ended in another tab
          dispatch({ type: 'CLEAR_USER' });
        } else {
          // New session started in another tab, reinitialize
          initializeAuth();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [initializeAuth]);

  const contextValue: AuthContextType = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    refreshToken,
    handleOAuth2Callback,
    authError: state.authError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};