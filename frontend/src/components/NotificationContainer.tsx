import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { Notification } from './Notification'; // Changed: use named import

/**
 * Container component for displaying notifications
 */
export const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          id={notification.id}
          message={notification.message}
          type={notification.type}
          severity={notification.severity}
          duration={notification.duration}
          actions={notification.actions}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
};

export default NotificationContainer;