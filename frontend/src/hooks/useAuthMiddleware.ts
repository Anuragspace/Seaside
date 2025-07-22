import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Feature types that require authentication
export type AuthRequiredFeature = 'recording' | 'profile' | 'room-creation' | 'room-management';

// Options for the auth middleware hook
export interface UseAuthMiddlewareOptions {
  requireAuth: boolean;
  feature?: AuthRequiredFeature;
  onAuthRequired?: () => void;
  redirectAfterAuth?: string;
  autoRedirect?: boolean; // Whether to automatically redirect after auth
}

// Return type for the hook
export interface UseAuthMiddlewareReturn {
  canAccess: boolean;
  requestAuth: () => void;
  isAuthModalOpen: boolean;
  closeAuthModal: () => void;
  authRequiredFeature?: AuthRequiredFeature;
  redirectAfterAuth?: string;
}

/**
 * Hook for managing conditional authentication requirements
 * Provides functionality to check if a user can access a feature
 * and request authentication when needed
 */
export const useAuthMiddleware = (options: UseAuthMiddlewareOptions): UseAuthMiddlewareReturn => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Determine if user can access the feature
  const canAccess = !options.requireAuth || isAuthenticated;

  // Debug logging
  console.log('Auth Middleware Debug:', {
    requireAuth: options.requireAuth,
    isAuthenticated,
    isLoading,
    canAccess,
    feature: options.feature
  });

  // Handle authentication success and redirects
  useEffect(() => {
    if (isAuthenticated && options.autoRedirect && options.redirectAfterAuth) {
      // Check if there's a stored redirect URL from the auth process
      const storedRedirectUrl = sessionStorage.getItem('auth_redirect_url');
      if (storedRedirectUrl) {
        sessionStorage.removeItem('auth_redirect_url');
        window.location.href = storedRedirectUrl;
      } else if (options.redirectAfterAuth) {
        window.location.href = options.redirectAfterAuth;
      }
    }
  }, [isAuthenticated, options.autoRedirect, options.redirectAfterAuth]);

  // Handle authentication modal closure when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && isAuthModalOpen) {
      setIsAuthModalOpen(false);
    }
  }, [isAuthenticated, isAuthModalOpen]);

  // Request authentication when needed
  const requestAuth = useCallback(() => {
    if (!isAuthenticated && options.requireAuth) {
      // Store current location for redirect after auth if specified
      if (options.redirectAfterAuth) {
        sessionStorage.setItem('auth_redirect_url', options.redirectAfterAuth);
      }

      // Call custom callback if provided
      if (options.onAuthRequired) {
        options.onAuthRequired();
      } else {
        // Default behavior: open auth modal
        setIsAuthModalOpen(true);
      }
    }
  }, [isAuthenticated, options.requireAuth, options.onAuthRequired, options.redirectAfterAuth]);

  // Close authentication modal
  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  return {
    canAccess: canAccess && !isLoading,
    requestAuth,
    isAuthModalOpen,
    closeAuthModal,
    authRequiredFeature: options.feature,
    redirectAfterAuth: options.redirectAfterAuth,
  };
};

/**
 * Predefined middleware configurations for common features
 */
export const authMiddlewareConfigs = {
  recording: {
    requireAuth: true,
    feature: 'recording' as AuthRequiredFeature,
  },
  profile: {
    requireAuth: true,
    feature: 'profile' as AuthRequiredFeature,
  },
  roomCreation: {
    requireAuth: false, // Rooms can be created without auth
    feature: 'room-creation' as AuthRequiredFeature,
  },
  roomManagement: {
    requireAuth: true,
    feature: 'room-management' as AuthRequiredFeature,
  },
} as const;

/**
 * Higher-order hook for specific features
 */
export const useRecordingAuth = () => {
  return useAuthMiddleware(authMiddlewareConfigs.recording);
};

export const useProfileAuth = () => {
  return useAuthMiddleware(authMiddlewareConfigs.profile);
};

export const useRoomCreationAuth = () => {
  return useAuthMiddleware(authMiddlewareConfigs.roomCreation);
};

export const useRoomManagementAuth = () => {
  return useAuthMiddleware(authMiddlewareConfigs.roomManagement);
};