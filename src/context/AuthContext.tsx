import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, onSnapshot, doc, getDoc, setDoc, updateDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  manualLogin: (email: string, pass: string) => Promise<void>;
  manualSignUp: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { logger } from '../lib/logger';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          logger.auth('User Detected', { email: firebaseUser.email, uid: firebaseUser.uid });
          
          // Use onSnapshot for real-time profile updates
          unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              const profile = { ...docSnap.data(), uid: docSnap.id } as UserProfile;
              // Ensure role is consistent with admin bootstrap
              const isSuperAdminEmail = firebaseUser.email?.toLowerCase() === 'zeeshanmaqbool200@gmail.com';
              if (isSuperAdminEmail && profile.role !== 'superadmin') {
                profile.role = 'superadmin';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'superadmin' });
              }
              // Basic migration and cleanup
              if (!profile.role) profile.role = 'student';
              if ((profile.role as string) === 'mudaris') {
                profile.role = 'teacher' as any;
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'teacher' });
              }
              if ((profile.role as string) === 'muntazim') {
                profile.role = 'manager' as any;
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'manager' });
              }
              if ((profile.role as string) === 'pending_mudaris') {
                profile.role = 'pending_teacher' as any;
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'pending_teacher' });
              }
              
              setUser(profile);
              logger.success(`Profile Updated: ${profile.displayName} (${profile.role})`);
            } else {
              // Try to find if user was pre-registered
              const findExisting = async () => {
                const { getDocs, query, collection, where, deleteDoc } = await import('firebase/firestore');
                const userEmail = firebaseUser.email || '';
                const q = query(collection(db, 'users'), where('email', '==', userEmail));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  const existingDoc = querySnapshot.docs[0];
                  const existingData = existingDoc.data() as UserProfile;
                  
                  const newUser: UserProfile = {
                    ...existingData,
                    uid: firebaseUser.uid,
                    photoURL: existingData.photoURL || firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(existingData.displayName)}&background=random&color=fff`
                  };
                  
                  await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                  if (existingDoc.id !== firebaseUser.uid) {
                    await deleteDoc(existingDoc.ref);
                  }
                  setUser(newUser);
                  return true;
                }
                return false;
              };

              findExisting().then((found) => {
                if (!found) {
                  const isSuperAdminEmail = firebaseUser.email?.toLowerCase() === 'zeeshanmaqbool200@gmail.com';
                  if (isSuperAdminEmail) {
                    const newUser: UserProfile = {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email || '',
                      displayName: firebaseUser.displayName || 'Administrator',
                      role: 'superadmin',
                      createdAt: Date.now(),
                      photoURL: firebaseUser.photoURL || undefined,
                    };
                    setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                    setUser(newUser);
                  } else {
                    signOut(auth);
                    setUser(null);
                    setError('Your account has been removed or is not authorized.');
                  }
                }
              });
            }
            setLoading(false);
          }, (error) => {
            setLoading(false);
          });
        } else {
          setUser(null);
          if (unsubscribeDoc) unsubscribeDoc();
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const manualLogin = React.useCallback(async (email: string, pass: string) => {
    try {
      setError(null);
      logger.auth('Manual Login Attempt', { email });
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      let message = 'Login failed. Check your email/password.';
      if (err.code === 'auth/invalid-credential') {
        message = 'Wrong email or password.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      }
      setError(message);
      throw err;
    }
  }, []);

  const manualSignUp = React.useCallback(async (email: string, pass: string, name: string, role: UserRole) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const finalRole = role === 'teacher' ? 'pending_teacher' : role;
      
      const newUser: UserProfile = {
        uid: firebaseUser.uid,
        email: email,
        displayName: name,
        role: finalRole as UserRole,
        createdAt: Date.now(),
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      setUser(newUser);
    } catch (err: any) {
      let message = 'Signup failed.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Please use a stronger password.';
      }
      setError(message);
      throw err;
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      logger.auth('Attempting Logout');
      await signOut(auth);
      logger.success('Logout Successful');
    } catch (err) {
      logger.error('Logout Failed', err);
    }
  }, []);

  const contextValue = React.useMemo(() => ({ 
    user, loading, error, manualLogin, manualSignUp, logout 
  }), [user, loading, error, manualLogin, manualSignUp, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
