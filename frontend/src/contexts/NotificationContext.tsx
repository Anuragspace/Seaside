import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { ErrorSeverity, ErrorService, ErrorRecoveryAction } from '../services/errorService';
import { AuthError } from '../services/authService';

// Notification interface
export interface NotificationData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  severity?: ErrorSeverity;
  duration?: number;
  actions?: ErrorRecoveryAction[];
  timestamp: number;
}

// Notification context type
export interface NotificationContextType {
  notifications: NotificationData[];
  addNotification: (notification: Omit<NotificationData, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  showError: (error: Error | AuthError, context?: any) => string;
  showSuccess: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
}

// Notification state
interface NotificationState {
  notifications: NotificationData[];
}

// Notification actions
type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: NotificationData }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL_NOTIFICATIONS' };

// Notification reducer
const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case 'CLEAR_ALL_NOTIFICATIONS':
      return {
        ...state,
        notifications: [],
      };
    default:
      return state;
  }
};

// Initial state
const initialState: NotificationState = {
  notifications: [],
};

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Notification provider props
interface NotificationProviderProps {
  children: ReactNode;
}

/**
 * Notification provider component
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  // Generate unique notification ID
  const generateNotificationId = useCallback((): string => {
    return `notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Add notification
  const addNotification = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp'>): string => {
    const id = generateNotificationId();
    const notificationData: NotificationData = {
      ...notification,
      id,
      timestamp: Date.now(),
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: notificationData });
    return id;
  }, [generateNotificationId]);

  // Remove notification
  const removeNotification = useCallback((id: string): void => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback((): void => {
    dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' });
  }, []);

  // Show error notification
  const showError = useCallback((error: Error | AuthError, context?: any): string => {
    // Process error through error service
    ErrorService.processError(error, context);
    const userFriendlyError = ErrorService.getUserFriendlyError(error);
    const recoveryActions = ErrorService.getRecoveryActions(error);

    return addNotification({
      message: userFriendlyError.message,
      type: 'error',
      severity: userFriendlyError.severity,
      duration: userFriendlyError.severity === ErrorSeverity.CRITICAL ? 0 : 8000, // Critical errors don't auto-dismiss
      actions: recoveryActions,
    });
  }, [addNotification]);

  // Show success notification
  const showSuccess = useCallback((message: string, duration: number = 4000): string => {
    return addNotification({
      message,
      type: 'success',
      duration,
    });
  }, [addNotification]);

  // Show warning notification
  const showWarning = useCallback((message: string, duration: number = 6000): string => {
    return addNotification({
      message,
      type: 'warning',
      duration,
    });
  }, [addNotification]);

  // Show info notification
  const showInfo = useCallback((message: string, duration: number = 5000): string => {
    return addNotification({
      message,
      type: 'info',
      duration,
    });
  }, [addNotification]);

  const contextValue: NotificationContextType = {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Custom hook to use notification context
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;