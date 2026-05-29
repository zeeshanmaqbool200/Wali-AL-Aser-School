import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, FeeReceipt, Notification as NotificationType, Course } from '../types';
import { useAuth } from './AuthContext';
import { cache, CACHE_KEYS } from '../lib/cache';

interface DataContextType {
  users: UserProfile[];
  receipts: FeeReceipt[];
  notifications: NotificationType[];
  availableCourses: Course[];
  expenses: any[];
  attendance: any[];
  loading: boolean;
  error: string | null;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  isSyncing: boolean;
  lastUpdate: number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const unsubscribes = useRef<(() => void)[]>([]);
  const lastNotifiedIds = useRef<Set<string>>(new Set());
  
  // Throttled cache write flags to prevent "too much cache" (CPU/IO overhead)
  const cacheThrottle = useRef<Record<string, number>>({});

  const isStaff = user?.role === 'superadmin' || user?.role === 'manager' || user?.role === 'teacher';
  const isAdmin = user?.role === 'superadmin' || user?.role === 'manager';

  // Throttled Cache Setter (Local Storage Tier)
  const persistToDisk = useCallback(async (key: string, data: any, delay: number = 2000) => {
    const now = Date.now();
    if (!cacheThrottle.current[key] || now - cacheThrottle.current[key] > delay) {
      cacheThrottle.current[key] = now;
      await cache.set(key, data);
    }
  }, []);

  // Load from tiered cache initially for fast first paint
  useEffect(() => {
    if (!user) return;

    const loadInitialData = async () => {
      try {
        const [cUsers, cReceipts, cNotifs, cCourses] = await Promise.all([
          cache.get<UserProfile[]>(CACHE_KEYS.USERS),
          cache.get<FeeReceipt[]>(CACHE_KEYS.FEES),
          cache.get<NotificationType[]>(CACHE_KEYS.NOTIFS),
          cache.get<Course[]>(CACHE_KEYS.COURSES)
        ]);
        
        if (cUsers) setUsers(cUsers);
        if (cReceipts) setReceipts(cReceipts);
        if (cNotifs) setNotifications(cNotifs);
        if (cCourses) setAvailableCourses(cCourses);
        
        if (cUsers || cReceipts) {
          setLoading(false);
        }
      } catch (e) {
        console.warn('Initial cache load failed:', e);
      }
    };

    loadInitialData();
  }, [user?.uid]);

  // Combined Native Notification Logic
  useEffect(() => {
    if (!user || notifications.length === 0) return;

    const unread = notifications.filter(n => 
      (!n.readBy || !n.readBy.includes(user.uid)) && 
      !lastNotifiedIds.current.has(n.id) &&
      (Date.now() - n.createdAt < 300000)
    );

    if (unread.length > 0 && Notification.permission === 'granted') {
      unread.forEach(n => {
        try {
          new Notification(n.title || 'Institutional Update', {
            body: n.message,
            icon: n.imageUrl || '/logo.png',
            tag: n.id,
          });
          lastNotifiedIds.current.add(n.id);
        } catch (e) {
          console.warn('Native notification failed:', e);
        }
      });
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } else if (unread.length > 0) {
      unread.forEach(n => lastNotifiedIds.current.add(n.id));
    }
  }, [notifications, user]);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      setReceipts([]);
      setNotifications([]);
      setAvailableCourses([]);
      setExpenses([]);
      setAttendance([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setIsSyncing(true);
    setError(null);

    const clearUnsubscribes = () => {
      unsubscribes.current.forEach(u => u());
      unsubscribes.current = [];
    };

    clearUnsubscribes();

    const onSyncError = (err: any, label: string) => {
      console.error(`${label} sync error:`, err);
      setError(`Failed to sync ${label.toLowerCase()}. Check permissions.`);
      setIsSyncing(false);
      setLoading(false);
    };

    // 1. Users sync
    const uQuery = isStaff ? query(collection(db, 'users')) : query(collection(db, 'users'), where('uid', '==', user.uid));
    const unsubUsers = onSnapshot(uQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setUsers(data);
      // Memory-first tiered cache update
      persistToDisk(CACHE_KEYS.USERS, data, isStaff ? 5000 : 2000); 
      setLastUpdate(Date.now());
      setIsSyncing(false);
      setLoading(false);
    }, (err) => onSyncError(err, 'Users'));
    unsubscribes.current.push(unsubUsers);

    // 2. Receipts sync
    let rQuery = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    if (!isStaff) {
      rQuery = query(collection(db, 'receipts'), where('studentId', '==', user.uid), orderBy('createdAt', 'desc'));
    }
    const unsubReceipts = onSnapshot(rQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[];
      setReceipts(data);
      persistToDisk(CACHE_KEYS.FEES, data, 5000);
      setIsSyncing(false);
    }, (err) => onSyncError(err, 'Receipts'));
    unsubscribes.current.push(unsubReceipts);

    // 3. Notifications sync
    const nQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(100));
    const unsubNotifs = onSnapshot(nQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationType[];
      setNotifications(data);
      persistToDisk(CACHE_KEYS.NOTIFS, data, 10000);
    }, (err) => onSyncError(err, 'Notifications'));
    unsubscribes.current.push(unsubNotifs);

    // 4. Courses sync
    const cQuery = query(collection(db, 'courses'), where('isPublished', '==', true), orderBy('createdAt', 'desc'));
    const unsubCourses = onSnapshot(cQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setAvailableCourses(data);
      persistToDisk(CACHE_KEYS.COURSES, data, 30000);
    }, (err) => onSyncError(err, 'Courses'));
    unsubscribes.current.push(unsubCourses);

    // 5. Attendance sync
    let aQuery = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(500));
    if (!isStaff) {
      aQuery = query(collection(db, 'attendance'), where('studentId', '==', user.uid), orderBy('date', 'desc'), limit(100));
    }
    const unsubAttend = onSnapshot(aQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAttendance(data);
    }, (err) => onSyncError(err, 'Attendance'));
    unsubscribes.current.push(unsubAttend);

    // 6. Expenses sync (Admin only)
    if (isAdmin) {
      const eQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
      const unsubExpenses = onSnapshot(eQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExpenses(data);
      }, (err) => onSyncError(err, 'Expenses'));
      unsubscribes.current.push(unsubExpenses);
    }

    return () => clearUnsubscribes();
  }, [user?.uid, isStaff, isAdmin, persistToDisk]);

  return (
    <DataContext.Provider value={{
      users,
      receipts,
      notifications,
      availableCourses,
      expenses,
      attendance,
      loading,
      error,
      isSaving,
      setIsSaving,
      isSyncing,
      lastUpdate
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
