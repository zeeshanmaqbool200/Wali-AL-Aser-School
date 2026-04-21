import { useState, useEffect } from 'react';
import { logger } from '../lib/logger';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'not-supported';

export interface HardwarePermissions {
  notifications: PermissionStatus;
  camera: PermissionStatus;
  microphone: PermissionStatus;
}

// Keys for localStorage
const PERMISSION_CHOICES_KEY = 'permission-choices';
const PERMISSION_ASKED_KEY = 'permission-asked';

interface PermissionChoices {
  notifications?: 'granted' | 'denied';
  camera?: 'granted' | 'denied';
  microphone?: 'granted' | 'denied';
}

interface PermissionAsked {
  notifications?: boolean;
  camera?: boolean;
  microphone?: boolean;
}

export function useHardwarePermissions() {
  const [permissions, setPermissions] = useState<HardwarePermissions>({
    notifications: 'prompt',
    camera: 'prompt',
    microphone: 'prompt',
  });

  const checkPermissions = async () => {
    const newPermissions: HardwarePermissions = { ...permissions };
    
    // Load saved choices from localStorage
    const savedChoices: PermissionChoices = JSON.parse(
      localStorage.getItem(PERMISSION_CHOICES_KEY) || '{}'
    );

    // Check Notifications
    if (!('Notification' in window)) {
      newPermissions.notifications = 'not-supported';
    } else {
      // If user already made a choice, respect it
      if (savedChoices.notifications) {
        newPermissions.notifications = savedChoices.notifications;
      } else {
        newPermissions.notifications = Notification.permission as PermissionStatus;
      }
    }

    // Check Camera & Microphone
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      const hasMic = devices.some(device => device.kind === 'audioinput');

      if (!hasCamera) {
        newPermissions.camera = 'not-supported';
      } else if (savedChoices.camera) {
        newPermissions.camera = savedChoices.camera;
      } else {
        const videoGranted = devices.some(d => d.kind === 'videoinput' && d.label !== '');
        if (videoGranted) {
          newPermissions.camera = 'granted';
        } else {
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
      } else if (savedChoices.microphone) {
        newPermissions.microphone = savedChoices.microphone;
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
    
    // Save user's choice to localStorage
    const savedChoices: PermissionChoices = JSON.parse(
      localStorage.getItem(PERMISSION_CHOICES_KEY) || '{}'
    );
    savedChoices.notifications = result as 'granted' | 'denied';
    localStorage.setItem(PERMISSION_CHOICES_KEY, JSON.stringify(savedChoices));
    
    // Mark that we asked
    const asked: PermissionAsked = JSON.parse(
      localStorage.getItem(PERMISSION_ASKED_KEY) || '{}'
    );
    asked.notifications = true;
    localStorage.setItem(PERMISSION_ASKED_KEY, JSON.stringify(asked));
    
    setPermissions(prev => ({ ...prev, notifications: result as PermissionStatus }));
    return result;
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      
      const savedChoices: PermissionChoices = JSON.parse(
        localStorage.getItem(PERMISSION_CHOICES_KEY) || '{}'
      );
      savedChoices.camera = 'granted';
      localStorage.setItem(PERMISSION_CHOICES_KEY, JSON.stringify(savedChoices));
      
      const asked: PermissionAsked = JSON.parse(
        localStorage.getItem(PERMISSION_ASKED_KEY) || '{}'
      );
      asked.camera = true;
      localStorage.setItem(PERMISSION_ASKED_KEY, JSON.stringify(asked));
      
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
      return 'granted';
    } catch (err) {
      const savedChoices: PermissionChoices = JSON.parse(
        localStorage.getItem(PERMISSION_CHOICES_KEY) || '{}'
      );
      savedChoices.camera = 'denied';
      localStorage.setItem(PERMISSION_CHOICES_KEY, JSON.stringify(savedChoices));
      
      const asked: PermissionAsked = JSON.parse(
        localStorage.getItem(PERMISSION_ASKED_KEY) || '{}'
      );
      asked.camera = true;
      localStorage.setItem(PERMISSION_ASKED_KEY, JSON.stringify(asked));
      
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      return 'denied';
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      const savedChoices: PermissionChoices = JSON.parse(
        localStorage.getItem(PERMISSION_CHOICES_KEY) || '{}'
      );
      savedChoices.microphone = 'granted';
      localStorage.setItem(PERMISSION_CHOICES_KEY, JSON.stringify(savedChoices));
      
      const asked: PermissionAsked = JSON.parse(
        localStorage.getItem(PERMISSION_ASKED_KEY) || '{}'
      );
      asked.microphone = true;
      localStorage.setItem(PERMISSION_ASKED_KEY, JSON.stringify(asked));
      
      setPermissions(prev => ({ ...prev, microphone: 'granted' }));
      return 'granted';
    } catch (err) {
      const savedChoices: PermissionChoices = JSON.parse(
        localStorage.getItem(PERMISSION_CHOICES_KEY) || '{}'
      );
      savedChoices.microphone = 'denied';
      localStorage.setItem(PERMISSION_CHOICES_KEY, JSON.stringify(savedChoices));
      
      const asked: PermissionAsked = JSON.parse(
        localStorage.getItem(PERMISSION_ASKED_KEY) || '{}'
      );
      asked.microphone = true;
      localStorage.setItem(PERMISSION_ASKED_KEY, JSON.stringify(asked));
      
      setPermissions(prev => ({ ...prev, microphone: 'denied' }));
      return 'denied';
    }
  };

  return {
    permissions,
    requestNotificationPermission,
    requestCameraPermission,
    requestMicrophonePermission,
    refresh: checkPermissions,
    hasAskedBefore: () => {
      const asked: PermissionAsked = JSON.parse(
        localStorage.getItem(PERMISSION_ASKED_KEY) || '{}'
      );
      return asked;
    },
    resetPermissionPreferences: () => {
      localStorage.removeItem(PERMISSION_CHOICES_KEY);
      localStorage.removeItem(PERMISSION_ASKED_KEY);
      checkPermissions();
    }
  };
}
