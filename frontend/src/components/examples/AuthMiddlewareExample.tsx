import React from 'react';
import { useRecordingAuth, useAuthMiddleware } from '../../hooks/useAuthMiddleware';
import { AuthRequestModal } from '../modals/AuthRequestModal';
import { RecordingAuthGuard, AuthMiddleware } from '../AuthMiddleware';

/**
 * Example component demonstrating different ways to use authentication middleware
 */
export const AuthMiddlewareExample: React.FC = () => {
  // Method 1: Using the hook directly
  const recordingAuth = useRecordingAuth();

  // Method 2: Using the hook with custom configuration
  const customAuth = useAuthMiddleware({
    requireAuth: true,
    feature: 'recording',
    redirectAfterAuth: '/dashboard',
    onAuthRequired: () => {
      console.log('Custom auth required handler');
    },
  });

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Authentication Middleware Examples</h1>

      {/* Example 1: Using hook directly with manual modal */}
      <div className="border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Method 1: Hook + Manual Modal</h2>
        <p className="text-gray-600 mb-4">
          Can access recording: {recordingAuth.canAccess ? 'Yes' : 'No'}
        </p>
        <button
          onClick={recordingAuth.requestAuth}
          disabled={recordingAuth.canAccess}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Start Recording
        </button>
        
        <AuthRequestModal
          isOpen={recordingAuth.isAuthModalOpen}
          onClose={recordingAuth.closeAuthModal}
          feature={recordingAuth.authRequiredFeature}
        />
      </div>

      {/* Example 2: Using AuthMiddleware component wrapper */}
      <div className="border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Method 2: Component Wrapper</h2>
        <AuthMiddleware
          requireAuth={true}
          feature="recording"
          fallback={
            <div className="text-gray-500 italic">
              Please sign in to access recording features
            </div>
          }
        >
          <button className="px-4 py-2 bg-green-600 text-white rounded">
            Recording Available!
          </button>
        </AuthMiddleware>
      </div>

      {/* Example 3: Using predefined guard components */}
      <div className="border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Method 3: Guard Components</h2>
        <RecordingAuthGuard
          fallback={
            <div className="text-yellow-600">
              🔒 Recording requires authentication
            </div>
          }
        >
          <div className="text-green-600">
            ✅ You can record audio and video!
          </div>
        </RecordingAuthGuard>
      </div>

      {/* Example 4: Custom auth configuration */}
      <div className="border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Method 4: Custom Configuration</h2>
        <p className="text-gray-600 mb-4">
          Can access feature: {customAuth.canAccess ? 'Yes' : 'No'}
        </p>
        <button
          onClick={customAuth.requestAuth}
          disabled={customAuth.canAccess}
          className="px-4 py-2 bg-purple-600 text-white rounded disabled:bg-gray-400"
        >
          Access Custom Feature
        </button>
      </div>

      {/* Example 5: Room creation (no auth required) */}
      <div className="border p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Method 5: Optional Auth</h2>
        <AuthMiddleware
          requireAuth={false}
          feature="room-creation"
        >
          <button className="px-4 py-2 bg-indigo-600 text-white rounded">
            Create Room (No Auth Required)
          </button>
        </AuthMiddleware>
      </div>
    </div>
  );
};