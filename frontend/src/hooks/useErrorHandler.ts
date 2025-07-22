import { useCallback } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { AuthError } from '../services/authService';
import { ErrorService, ErrorCategory } from '../services/errorService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook for handling errors with appropriate user feedback
 */
export const useErrorHandler = () => {
  const { showError } = useNotifications();
  const { signOut } = useAuth();

  /**
   * Handle authentication errors with appropriate actions
   */
  const handleAuthError = useCallback((error: Error | AuthError, context?: any) => {
    // Process error through error service
    ErrorService.processError(error, context);
    
    // Show notification to user
    const notificationId = showError(error, context);
    
    // Handle specific auth errors
    if (error instanceof AuthError) {
      // Handle unauthorized errors (401)
      if (error.statusCode === 401) {
        // Sign out user on authentication failures
        signOut().catch(console.error);
      }
      
      // Handle specific error codes
      switch (error.code) {
        case 'TOKEN_EXPIRED':
        case 'NO_REFRESH_TOKEN':
          // Already handled by signOut above
          break;
          
        case 'INVALID_STATE':
        case 'OAUTH2_ACCESS_DENIED':
          // Redirect to sign-in page after a short delay
          setTimeout(() => {
            window.location.href = '/sign-in';
          }, 2000);
          break;
      }
    }
    
    return notificationId;
  }, [showError, signOut]);

  /**
   * Handle network errors with appropriate actions
   */
  const handleNetworkError = useCallback((error: Error, context?: any) => {
    // Process error through error service
    ErrorService.processError(error, {
      ...context,
      category: ErrorCategory.NETWORK,
    });
    
    // Show notification to user
    return showError(error, context);
  }, [showError]);

  /**
   * Handle validation errors with appropriate actions
   */
  const handleValidationError = useCallback((error: Error, context?: any) => {
    // Process error through error service
    ErrorService.processError(error, {
      ...context,
      category: ErrorCategory.VALIDATION,
    });
    
    // Show notification to user
    return showError(error, context);
  }, [showError]);

  /**
   * Handle general errors with appropriate actions
   */
  const handleError = useCallback((error: Error | AuthError, context?: any) => {
    // Determine error type and use appropriate handler
    if (error instanceof AuthError) {
      return handleAuthError(error, context);
    }
    
    if (error.message.includes('Network') || error.message.includes('timeout')) {
      return handleNetworkError(error, context);
    }
    
    if (error.message.includes('validation') || error.message.includes('required')) {
      return handleValidationError(error, context);
    }
    
    // Process general error through error service
    ErrorService.processError(error, context);
    
    // Show notification to user
    return showError(error, context);
  }, [handleAuthError, handleNetworkError, handleValidationError, showError]);

  return {
    handleError,
    handleAuthError,
    handleNetworkError,
    handleValidationError,
  };
};

export default useErrorHandler;