import { useState, useEffect } from 'react';

export interface NotificationState {
  permission: NotificationPermission;
  isSupported: boolean;
}

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    permission: 'default',
    isSupported: false,
  });

  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
    }));
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!state.isSupported) return 'denied';

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  };

  const showLocalNotification = (title: string, options?: NotificationOptions) => {
    if (state.permission === 'granted' && state.isSupported) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/favicon.svg',
          ...options,
        });
      });
    }
  };

  return {
    ...state,
    requestPermission,
    showLocalNotification,
  };
}
