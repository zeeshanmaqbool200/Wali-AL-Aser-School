import { useState, useEffect } from 'react';
import { logger } from '../lib/logger';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'not-supported';

export interface HardwarePermissions {
  notifications: PermissionStatus;
  camera: PermissionStatus;
  microphone: PermissionStatus;
}

export function useHardwarePermissions() {
  const [permissions, setPermissions] = useState<HardwarePermissions>({
    notifications: 'prompt',
    camera: 'prompt',
    microphone: 'prompt',
  });

  const checkPermissions = async () => {
    const newPermissions: HardwarePermissions = { ...permissions };

    // Check Notifications
    if (!('Notification' in window)) {
      newPermissions.notifications = 'not-supported';
    } else {
      newPermissions.notifications = Notification.permission as PermissionStatus;
    }

    // Check Camera & Microphone
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      const hasMic = devices.some(device => device.kind === 'audioinput');

      if (!hasCamera) {
        newPermissions.camera = 'not-supported';
      } else {
        // Check if we already have permission by looking at labels
        const videoGranted = devices.some(d => d.kind === 'videoinput' && d.label !== '');
        if (videoGranted) {
          newPermissions.camera = 'granted';
        } else {
          // Use Permissions API as a secondary check if available
          try {
            const status = await navigator.permissions.query({ name: 'camera' as any });
            newPermissions.camera = status.state as PermissionStatus;
          } catch (e) {
            newPermissions.camera = 'prompt';
          }
        }
      }

      if (!hasMic) {
        newPermissions.microphone = 'not-supported';
      } else {
        const audioGranted = devices.some(d => d.kind === 'audioinput' && d.label !== '');
        if (audioGranted) {
          newPermissions.microphone = 'granted';
        } else {
          try {
            const status = await navigator.permissions.query({ name: 'microphone' as any });
            newPermissions.microphone = status.state as PermissionStatus;
          } catch (e) {
            newPermissions.microphone = 'prompt';
          }
        }
      }
    } catch (err) {
      logger.error('Error checking hardware devices', err);
    }

    setPermissions(newPermissions);
  };

  useEffect(() => {
    checkPermissions();
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return 'not-supported';
    const result = await Notification.requestPermission();
    setPermissions(prev => ({ ...prev, notifications: result as PermissionStatus }));
    return result;
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
      return 'granted';
    } catch (err) {
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      return 'denied';
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, microphone: 'granted' }));
      return 'granted';
    } catch (err) {
      setPermissions(prev => ({ ...prev, microphone: 'denied' }));
      return 'denied';
    }
  };

  return {
    permissions,
    requestNotificationPermission,
    requestCameraPermission,
    requestMicrophonePermission,
    refresh: checkPermissions
  };
}
