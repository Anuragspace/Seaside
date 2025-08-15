import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import SignUpForm from './components/SignUpForm';
import SignInForm from './components/SignInForm';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import ReactGA from 'react-ga';  
import { getAuthRedirect } from './utils/routeUtils';
function App() {
  const { isAuthenticated, isLoading, authError } = useAuth();
  const location = useLocation();

  const Tracker = import.meta.env.VITE_GA_TRACKING_ID;

  useEffect(() => {
    if(Tracker) {
      ReactGA.initialize(Tracker);
    }
  }, [Tracker]);

  // tracking the page views
  useEffect(() => {
    if(Tracker){
      ReactGA.pageview(location.pathname + location.search);
    }
  }, [location, Tracker])

  // see if someone joins the room
  useEffect(() => {
    if(location.pathname.startsWith("/room/")){
      ReactGA.event({
        category: 'Room',
        action: 'Join Room',
        label: location.pathname
      });
    }
  }, [location])

  // Handle auth errors
  useEffect(() => {
    if (authError) {
      console.error('Auth error:', authError);
    }
  }, [authError]);

  // Show loading state while authentication status is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }

  // Check if current route requires authentication-based redirect
  const authRedirect = getAuthRedirect(isAuthenticated, location.pathname, location);

  if (authRedirect.shouldRedirect) {
    return (
      <Navigate
        to={authRedirect.redirectTo}
        state={authRedirect.state}
        replace
      />
    );
  }

  return (
    <Routes>
      {/* Public routes - accessible to all users */}
      <Route path="/" element={<HomePage />} />

      {/* Room routes - accessible to all users (guest access allowed) */}
      <Route path="/room/:roomId" element={<RoomPage />} />

      {/* Authentication routes - only accessible to unauthenticated users */}
      <Route
        path="/sign-in"
        element={
          <PublicOnlyRoute>
            <SignInForm />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicOnlyRoute>
            <SignUpForm />
          </PublicOnlyRoute>
        }
      />

      {/* Protected routes - require authentication */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <div className="p-8 text-center">
              <h1 className="text-2xl font-bold mb-4">User Profile</h1>
              <p>This is a protected route that requires authentication.</p>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Catch-all route - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;