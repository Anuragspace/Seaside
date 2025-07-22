import { Location } from 'react-router-dom';

/**
 * Route protection utilities for authentication-based navigation
 */

/**
 * Get the redirect path after successful authentication
 * 
 * @param location - Current location object from react-router
 * @param defaultPath - Default path to redirect to if no 'from' state exists
 * @returns The path to redirect to after authentication
 */
export const getRedirectPath = (location: Location, defaultPath: string = '/'): string => {
  const state = location.state as { from?: Location } | null;
  return state?.from?.pathname || defaultPath;
};

/**
 * Create a location state object for preserving the current location
 * 
 * @param currentLocation - The current location to preserve
 * @returns Location state object
 */
export const createLocationState = (currentLocation: Location) => ({
  from: currentLocation,
});

/**
 * Check if a route requires authentication based on route patterns
 * 
 * @param pathname - The pathname to check
 * @returns Whether the route requires authentication
 */
export const isProtectedRoute = (pathname: string): boolean => {
  const protectedRoutes = [
    '/profile',
    '/settings',
    '/dashboard',
    // Add more protected route patterns as needed
  ];

  const protectedPatterns = [
    /^\/room\/[^/]+\/admin/, // Room admin routes
    /^\/user\/[^/]+\/private/, // Private user routes
    // Add more regex patterns for protected routes
  ];

  // Check exact matches
  if (protectedRoutes.includes(pathname)) {
    return true;
  }

  // Check pattern matches
  return protectedPatterns.some(pattern => pattern.test(pathname));
};

/**
 * Check if a route should only be accessible to unauthenticated users
 * 
 * @param pathname - The pathname to check
 * @returns Whether the route is public-only
 */
export const isPublicOnlyRoute = (pathname: string): boolean => {
  const publicOnlyRoutes = [
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
  ];

  return publicOnlyRoutes.includes(pathname);
};

/**
 * Get the appropriate redirect path based on authentication status and current route
 * 
 * @param isAuthenticated - Current authentication status
 * @param pathname - Current pathname
 * @param location - Current location object
 * @returns Object with redirect information
 */
export const getAuthRedirect = (
  isAuthenticated: boolean,
  pathname: string,
  location: Location
): { shouldRedirect: boolean; redirectTo: string; state?: any } => {
  // If user is authenticated and on a public-only route, redirect to home
  if (isAuthenticated && isPublicOnlyRoute(pathname)) {
    return {
      shouldRedirect: true,
      redirectTo: getRedirectPath(location, '/'),
    };
  }

  // If user is not authenticated and on a protected route, redirect to sign-in
  if (!isAuthenticated && isProtectedRoute(pathname)) {
    return {
      shouldRedirect: true,
      redirectTo: '/sign-in',
      state: createLocationState(location),
    };
  }

  return { shouldRedirect: false, redirectTo: '' };
};

/**
 * Route configuration for different authentication states
 */
export const ROUTE_CONFIG = {
  // Routes that require authentication
  PROTECTED: [
    '/profile',
    '/settings',
    '/dashboard',
  ],
  
  // Routes that should only be accessible to unauthenticated users
  PUBLIC_ONLY: [
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
  ],
  
  // Routes accessible to all users regardless of authentication status
  PUBLIC: [
    '/',
    '/about',
    '/contact',
    '/help',
  ],
  
  // Default redirects
  DEFAULTS: {
    AUTHENTICATED_REDIRECT: '/',
    UNAUTHENTICATED_REDIRECT: '/sign-in',
  },
} as const;

/**
 * Navigation helper for programmatic navigation with authentication awareness
 */
export class AuthAwareNavigator {
  /**
   * Navigate to a route with authentication checks
   * 
   * @param navigate - React Router navigate function
   * @param to - Destination path
   * @param isAuthenticated - Current authentication status
   * @param options - Navigation options
   */
  static navigateWithAuth(
    navigate: (to: string, options?: any) => void,
    to: string,
    isAuthenticated: boolean,
    options: { replace?: boolean; state?: any } = {}
  ): void {
    // If trying to access protected route without authentication
    if (!isAuthenticated && isProtectedRoute(to)) {
      navigate('/sign-in', {
        ...options,
        state: { from: { pathname: to } },
      });
      return;
    }

    // If authenticated user trying to access public-only route
    if (isAuthenticated && isPublicOnlyRoute(to)) {
      navigate('/', { ...options });
      return;
    }

    // Normal navigation
    navigate(to, options);
  }
}