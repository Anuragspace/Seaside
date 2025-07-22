import React from 'react';
import { useAuthMiddleware, UseAuthMiddlewareOptions } from '../hooks/useAuthMiddleware';
import { AuthRequestModal } from './modals/AuthRequestModal';

interface AuthMiddlewareProps extends UseAuthMiddlewareOptions {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that wraps children with authentication middleware
 * Automatically shows auth modal when authentication is required
 */
export const AuthMiddleware: React.FC<AuthMiddlewareProps> = ({
  children,
  fallback,
  ...options
}) => {
  const {
    canAccess,
    requestAuth,
    isAuthModalOpen,
    closeAuthModal,
    authRequiredFeature,
    redirectAfterAuth,
  } = useAuthMiddleware(options);

  // If authentication is required but user can't access, show fallback or request auth
  if (options.requireAuth && !canAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Auto-request auth if no fallback is provided
    React.useEffect(() => {
      requestAuth();
    }, [requestAuth]);
  }

  return (
    <>
      {children}
      <AuthRequestModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        feature={authRequiredFeature}
        redirectAfterAuth={redirectAfterAuth}
      />
    </>
  );
};

/**
 * Higher-order component for wrapping components with auth middleware
 */
export const withAuthMiddleware = <P extends object>(
  Component: React.ComponentType<P>,
  options: UseAuthMiddlewareOptions
) => {
  return React.forwardRef<any, P>((props, ref) => (
    <AuthMiddleware {...options}>
      <Component {...props} ref={ref} />
    </AuthMiddleware>
  ));
};

/**
 * Predefined auth middleware components for common use cases
 */
export const RecordingAuthGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <AuthMiddleware requireAuth={true} feature="recording" fallback={fallback}>
    {children}
  </AuthMiddleware>
);

export const ProfileAuthGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <AuthMiddleware requireAuth={true} feature="profile" fallback={fallback}>
    {children}
  </AuthMiddleware>
);

export const RoomManagementAuthGuard: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <AuthMiddleware requireAuth={true} feature="room-management" fallback={fallback}>
    {children}
  </AuthMiddleware>
);