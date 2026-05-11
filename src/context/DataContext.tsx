import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, FeeReceipt, Notification as NotificationType, Course, InstituteSettings } from '../types';
import { useAuth } from './AuthContext';

interface DataContextType {
  users: UserProfile[];
  receipts: FeeReceipt[];
  notifications: NotificationType[];
  availableCourses: Course[];
  expenses: any[];
  loading: boolean;
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
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const unsubscribes = useRef<(() => void)[]>([]);
  const lastNotifiedIds = useRef<Set<string>>(new Set());

  // LocalStorage keys
  const CACHE_KEYS = {
    USERS: 'institute_cache_users',
    RECEIPTS: 'institute_cache_receipts',
    NOTIFS: 'institute_cache_notifs',
    COURSES: 'institute_cache_courses',
    EXPENSES: 'institute_cache_expenses'
  };

  const isStaff = user?.role === 'superadmin' || user?.role === 'manager' || user?.role === 'teacher';
  const isAdmin = user?.role === 'superadmin' || user?.role === 'manager';

  // Load from cache initially
  useEffect(() => {
    if (user) {
      try {
        const cachedUsers = localStorage.getItem(CACHE_KEYS.USERS);
        const cachedReceipts = localStorage.getItem(CACHE_KEYS.RECEIPTS);
        const cachedNotifs = localStorage.getItem(CACHE_KEYS.NOTIFS);
        const cachedCourses = localStorage.getItem(CACHE_KEYS.COURSES);
        const cachedExpenses = localStorage.getItem(CACHE_KEYS.EXPENSES);

        if (cachedUsers) setUsers(JSON.parse(cachedUsers));
        if (cachedReceipts) setReceipts(JSON.parse(cachedReceipts));
        if (cachedNotifs) setNotifications(JSON.parse(cachedNotifs));
        if (cachedCourses) setAvailableCourses(JSON.parse(cachedCourses));
        if (cachedExpenses) setExpenses(JSON.parse(cachedExpenses));
      } catch (e) {
        console.warn('Cache load failed:', e);
      }
    }
  }, [user?.uid]);

  // Native Notification Logic
  useEffect(() => {
    if (!user || notifications.length === 0) return;

    // Filter unread notifications that haven't been notified in this session
    const unread = notifications.filter(n => 
      (!n.readBy || !n.readBy.includes(user.uid)) && 
      !lastNotifiedIds.current.has(n.id) &&
      (Date.now() - n.createdAt < 300000) // Only notify for ones created in last 5 minutes to avoid flood on load
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
      
      // Vibrate if available
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } else if (unread.length > 0) {
      // Just mark as "notified session-wise" so we don't keep checking if permission is denied/default
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
      setLoading(false);
      return;
    }

    setLoading(true);
    setIsSyncing(true);

    const clearUnsubscribes = () => {
      unsubscribes.current.forEach(u => u());
      unsubscribes.current = [];
    };

    clearUnsubscribes();

    // 1. Users sync (Staff only)
    if (isStaff) {
      const uQuery = query(collection(db, 'users'));
      const unsubUsers = onSnapshot(uQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
        setUsers(data);
        localStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(data));
        setLastUpdate(Date.now());
        setIsSyncing(false);
        setLoading(false);
      });
      unsubscribes.current.push(unsubUsers);
    } else {
      setUsers([user]);
    }

    // 2. Receipts sync
    let rQuery = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    if (!isStaff) {
      rQuery = query(collection(db, 'receipts'), where('studentId', '==', user.uid), orderBy('createdAt', 'desc'));
    }
    const unsubReceipts = onSnapshot(rQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FeeReceipt[];
      setReceipts(data);
      localStorage.setItem(CACHE_KEYS.RECEIPTS, JSON.stringify(data));
      setLastUpdate(Date.now());
      setIsSyncing(false);
    });
    unsubscribes.current.push(unsubReceipts);

    // 3. Notifications sync
    const nQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
    const unsubNotifs = onSnapshot(nQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationType[];
      setNotifications(data);
      localStorage.setItem(CACHE_KEYS.NOTIFS, JSON.stringify(data));
      setLastUpdate(Date.now());
      setIsSyncing(false);
    });
    unsubscribes.current.push(unsubNotifs);

    // 4. Courses sync
    const cQuery = query(collection(db, 'courses'), where('isPublished', '==', true), orderBy('createdAt', 'desc'));
    const unsubCourses = onSnapshot(cQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setAvailableCourses(data);
      localStorage.setItem(CACHE_KEYS.COURSES, JSON.stringify(data));
      setLastUpdate(Date.now());
      setIsSyncing(false);
    });
    unsubscribes.current.push(unsubCourses);

    // 5. Expenses sync (Admin only)
    if (isAdmin) {
      const eQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
      const unsubExpenses = onSnapshot(eQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setExpenses(data);
        localStorage.setItem(CACHE_KEYS.EXPENSES, JSON.stringify(data));
        setLastUpdate(Date.now());
        setIsSyncing(false);
      });
      unsubscribes.current.push(unsubExpenses);
    }

    return () => clearUnsubscribes();
  }, [user?.uid, isStaff, isAdmin]);

  return (
    <DataContext.Provider value={{
      users,
      receipts,
      notifications,
      availableCourses,
      expenses,
      loading,
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
