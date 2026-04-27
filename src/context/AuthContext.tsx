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
          
          // Use onSnapshot for real-time profile updates (important for settings)
          unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              const profile = { ...docSnap.data(), uid: docSnap.id } as UserProfile;
              // Ensure role is consistent with admin bootstrap
              const isSuperAdminEmail = firebaseUser.email === 'zeeshanmaqbool200@gmail.com';
              if (isSuperAdminEmail && profile.role !== 'superadmin') {
                profile.role = 'superadmin';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'superadmin' });
              } else if (!isSuperAdminEmail && profile.role === 'superadmin') {
                // Demote unauthorized superadmins to muntazim (admin)
                profile.role = 'muntazim';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'muntazim' });
              }
              // Ensure role exists, default to student if missing
              if (!profile.role) {
                profile.role = 'student';
              }
              // Migration for role name changes
              if ((profile.role as string) === 'approved_mudaris' || (profile.role as string) === 'teacher') {
                profile.role = 'mudaris';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'mudaris' });
              }
              if ((profile.role as string) === 'admin' && !isSuperAdminEmail) {
                profile.role = 'muntazim';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'muntazim' });
              }
              setUser(profile);
              logger.success(`Profile Updated: ${profile.displayName} (${profile.role})`);
            } else {
              // Try to find if user was pre-registered by admin using email
              const findExistingByEmail = async () => {
                const { getDocs, query, collection, where, deleteDoc } = await import('firebase/firestore');
                const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  const existingDoc = querySnapshot.docs[0];
                  const existingData = existingDoc.data() as UserProfile;
                  
                  // Create the UID-based doc with the existing data
                  const newUser: UserProfile = {
                    ...existingData,
                    uid: firebaseUser.uid, // Ensure UID is set
                    photoURL: firebaseUser.photoURL || existingData.photoURL || `https://ui-avatars.com/api/?name=${existingData.displayName}&background=random`
                  };
                  
                  await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                  
                  // Delete the old doc (id-less or with different ID)
                  if (existingDoc.id !== firebaseUser.uid) {
                    await deleteDoc(existingDoc.ref);
                    logger.info(`Merged pre-registered account: ${firebaseUser.email}`);
                  }
                  
                  setUser(newUser);
                  return true;
                }
                return false;
              };

              findExistingByEmail().then((found) => {
                if (!found) {
                  const isSuperAdminEmail = firebaseUser.email === 'zeeshanmaqbool200@gmail.com';
                  
                  if (isSuperAdminEmail) {
                    // Bootstrap new user for super admin
                    const newUser: UserProfile = {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email || '',
                      displayName: firebaseUser.displayName || 'Super Admin',
                      role: 'superadmin',
                      createdAt: Date.now(),
                      photoURL: firebaseUser.photoURL || undefined,
                    };
                    setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                    setUser(newUser);
                    logger.success('Super Admin Profile Bootstrapped', newUser);
                  } else {
                    // If not super admin and doc is missing, they were likely deleted or unauthorized
                    // Stop auto-bootstrap to prevent users from "coming back"
                    logger.warn('User document missing and not superadmin. Logging out.', firebaseUser.email);
                    signOut(auth);
                    setUser(null);
                    setError('Your account has been removed or is not authorized.');
                  }
                }
              }).catch(err => {
                logger.error('Failed to merge pre-registered account', err);
              });
            }
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            setLoading(false);
          });
        } else {
          setUser(null);
          if (unsubscribeDoc) unsubscribeDoc();
          setLoading(false);
          logger.auth('No User Session');
        }
      } catch (err) {
        logger.error('Auth State Change Error', err);
        setError('Failed to load user profile');
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
      logger.auth('Attempting Manual Login', { email });
      await signInWithEmailAndPassword(auth, email, pass);
      logger.success('Manual Login Successful');
    } catch (err: any) {
      logger.error('Manual Login Failed', err);
      let message = 'Failed to sign in';
      if (err.code === 'auth/operation-not-allowed') {
        message = 'Email/Password sign-in is not enabled in the Firebase Console.';
      } else if (err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (err.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      }
      setError(message);
      throw err;
    }
  }, []);

  const manualSignUp = React.useCallback(async (email: string, pass: string, name: string, role: UserRole) => {
    try {
      setError(null);
      logger.auth('Attempting Manual Sign Up', { email, name, role });
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const isSuperAdminEmail = firebaseUser.email === 'zeeshanmaqbool200@gmail.com';
      const finalRole = isSuperAdminEmail ? 'superadmin' : (role === ('teacher' as any) ? 'pending_mudaris' : role);
      
      const newUser: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: name,
        role: finalRole as UserRole,
        createdAt: Date.now(),
      };
      
      await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
      setUser(newUser);
      logger.success('Manual Sign Up Successful', newUser);
    } catch (err: any) {
      logger.error('Manual Sign Up Failed', err);
      let message = 'Failed to sign up';
      if (err.code === 'auth/operation-not-allowed') {
        message = 'Email/Password sign-up is not enabled in the Firebase Console. Please enable it in Authentication > Sign-in method.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'An account already exists with this email.';
      } else if (err.code === 'auth/weak-password') {
        message = 'The password is too weak.';
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
