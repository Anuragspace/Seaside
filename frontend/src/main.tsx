import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationContainer from './components/NotificationContainer';
import { setupGlobalErrorHandlers } from './utils/globalErrorHandler';

// Initialize global error handlers
setupGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <NotificationProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
          <NotificationContainer />
        </Router>
      </AuthProvider>
    </NotificationProvider>
  </ErrorBoundary>
);