import React, { useEffect, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where, or } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useNotifications } from '../services/notificationService';
import { Notification } from '../types';

import { logger } from '../lib/logger';

export default function NotificationListener() {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { showLocalNotification, permission } = useNotifications();
  const isFirstLoad = useRef(true);
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user?.uid) return;

    // Listen for the most recent notification using a rule-compliant OR query
    const isAdmin = user.role === 'superadmin';
    const isMudaris = user.role === 'approved_mudaris';
    
    let q;
    if (isAdmin || isMudaris) {
      // Admins/Mudaris see all relevant ones (rules permit blanket listing for them)
      q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
    } else {
      // Students follow strict rules, so query must explicitly filter
      q = query(
        collection(db, 'notifications'),
        or(
          where('targetType', '==', 'all'),
          where('targetId', '==', user.uid),
          where('targetId', '==', user.grade || 'none'),
          where('targetId', '==', user.maktabLevel || 'none')
        ),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        isFirstLoad.current = false;
        return;
      }

      // Process in reverse (oldest first) to maintain order if multiple arrive
      const docs = [...snapshot.docs].reverse();

      docs.forEach(doc => {
        const latestNotif = { id: doc.id, ...doc.data() } as Notification;

        // Skip if it's the first load or we've already processed this notification
        if (isFirstLoad.current) {
          processedIds.current.add(latestNotif.id);
          return;
        }

        if (processedIds.current.has(latestNotif.id)) {
          return;
        }

        processedIds.current.add(latestNotif.id);

        // Check if the notification is for this user
        const isTargeted = 
          latestNotif.targetType === 'all' ||
          (latestNotif.targetType === 'individual' && latestNotif.targetId === user.uid) ||
          (latestNotif.targetType === 'class' && latestNotif.targetId === user.grade);

        // Don't show if the user is the sender
        if (isTargeted && latestNotif.senderId !== user.uid) {
          if (!latestNotif.readBy.includes(user.uid)) {
            logger.db('New Notification Received', `notifications/${latestNotif.id}`, latestNotif);
            const prefs = user.notificationPrefs || { inAppToasts: true, push: true };

            // Show in-app toast if enabled
            if (prefs.inAppToasts) {
              showToast({
                title: latestNotif.title,
                message: latestNotif.message,
                type: latestNotif.type === 'fee_request' ? 'warning' : 'info',
                duration: 6000
              });
            }

            // Show system notification if enabled and permitted
            if (prefs.push && permission === 'granted') {
              showLocalNotification(latestNotif.title, {
                body: latestNotif.message,
                tag: latestNotif.id,
                data: { url: '/notifications' }
              });
            }
          }
        }
      });

      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        logger.info('Notification Listener Active');
      }
    });

    return () => unsubscribe();
  }, [user?.uid]); // Only depend on UID

  return null;
}
