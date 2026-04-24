import React, { useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';

export default function SyncNotifier() {
  const { showToast } = useNotification();

  useEffect(() => {
    const handleSyncComplete = () => {
      showToast({
        title: 'Sync Complete',
        message: 'Offline changes synchronized successfully!',
        type: 'success',
        duration: 5000
      });
    };

    const handleOffline = () => {
      showToast({
        title: 'Offline Mode',
        message: 'Saved offline — will sync when online.',
        type: 'warning',
        duration: 4000
      });
    };

    const handleRateLimit = () => {
      showToast({
        title: 'System Busy (Offload)',
        message: 'Rate limit hit. Please wait a moment for the system to offload and resume.',
        type: 'error',
        duration: 8000
      });
    };

    window.addEventListener('sync-complete', handleSyncComplete);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('firestore-rate-limit', handleRateLimit);

    return () => {
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('firestore-rate-limit', handleRateLimit);
    };
  }, [showToast]);

  return null;
}
