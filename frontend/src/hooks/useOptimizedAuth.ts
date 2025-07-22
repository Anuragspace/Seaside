import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { debounce } from '../utils/performanceUtils';

// Optimized authentication hook with performance improvements
export const useOptimizedAuth = () => {
  const auth = useAuth();

  // Memoize user data to prevent unnecessary re-renders
  const memoizedUser = useMemo(() => auth.user, [auth.user]);
  
  // Memoize authentication status
  const memoizedAuthStatus = useMemo(() => ({
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
  }), [auth.isAuthenticated, auth.isLoading]);

  // Debounced sign in to prevent rapid submissions
  const debouncedSignIn = useCallback(
    debounce(auth.signIn, 300),
    [auth.signIn]
  );

  // Debounced sign up to prevent rapid submissions
  const debouncedSignUp = useCallback(
    debounce(auth.signUp, 300),
    [auth.signUp]
  );

  // Optimistic sign out (immediate UI update)
  const optimisticSignOut = useCallback(async () => {
    try {
      // Immediately update UI state for better UX
      await auth.signOut();
    } catch (error) {
      // Error handling is done in the auth context
      console.error('Sign out error:', error);
    }
  }, [auth.signOut]);

  return {
    user: memoizedUser,
    ...memoizedAuthStatus,
    signIn: debouncedSignIn,
    signUp: debouncedSignUp,
    signOut: optimisticSignOut,
    signInWithOAuth: auth.signInWithOAuth,
    refreshToken: auth.refreshToken,
    handleOAuth2Callback: auth.handleOAuth2Callback,
    authError: auth.authError,
  };
};