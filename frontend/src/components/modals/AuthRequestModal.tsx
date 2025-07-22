import React, { useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthRequiredFeature } from '../../hooks/useAuthMiddleware';

interface AuthRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: AuthRequiredFeature;
  redirectAfterAuth?: string;
}

// Feature-specific messages
const getFeatureMessage = (feature?: AuthRequiredFeature): { title: string; description: string } => {
  switch (feature) {
    case 'recording':
      return {
        title: 'Sign in to Record',
        description: 'Recording audio and video requires an account to ensure your content is saved securely and associated with your profile.',
      };
    case 'profile':
      return {
        title: 'Sign in Required',
        description: 'You need to be signed in to access your profile and account settings.',
      };
    case 'room-management':
      return {
        title: 'Sign in to Manage Rooms',
        description: 'Managing room settings and permissions requires an account.',
      };
    default:
      return {
        title: 'Sign in Required',
        description: 'This feature requires you to be signed in to continue.',
      };
  }
};

export const AuthRequestModal: React.FC<AuthRequestModalProps> = ({
  isOpen,
  onClose,
  feature,
  redirectAfterAuth,
}) => {
  const { signInWithOAuth } = useAuth();
  const { title, description } = getFeatureMessage(feature);

  // Handle OAuth sign-in
  const handleOAuthSignIn = useCallback(async (provider: 'google' | 'github') => {
    try {
      // Store redirect URL if provided
      if (redirectAfterAuth) {
        sessionStorage.setItem('auth_redirect_url', redirectAfterAuth);
      }
      
      await signInWithOAuth(provider);
      onClose();
    } catch (error) {
      console.error(`${provider} sign-in failed:`, error);
      // Error handling is managed by the auth context
    }
  }, [signInWithOAuth, redirectAfterAuth, onClose]);

  // Handle navigation to sign-in page
  const handleNavigateToSignIn = useCallback(() => {
    // Store redirect URL if provided
    if (redirectAfterAuth) {
      sessionStorage.setItem('auth_redirect_url', redirectAfterAuth);
    }
    
    // Navigate to sign-in page
    window.location.href = '/sign-in';
  }, [redirectAfterAuth]);

  // Handle navigation to sign-up page
  const handleNavigateToSignUp = useCallback(() => {
    // Store redirect URL if provided
    if (redirectAfterAuth) {
      sessionStorage.setItem('auth_redirect_url', redirectAfterAuth);
    }
    
    // Navigate to sign-up page
    window.location.href = '/sign-up';
  }, [redirectAfterAuth]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-6">{description}</p>

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-4">
          <button
            onClick={() => handleOAuthSignIn('google')}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => handleOAuthSignIn('github')}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Email/Password Options */}
        <div className="space-y-2">
          <button
            onClick={handleNavigateToSignIn}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Sign In with Email
          </button>
          
          <button
            onClick={handleNavigateToSignUp}
            className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors font-medium"
          >
            Create New Account
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Continue without signing in
          </button>
        </div>
      </div>
    </div>
  );
};