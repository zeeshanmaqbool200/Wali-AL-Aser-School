import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, onSnapshot, doc, getDoc, setDoc, updateDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, getDocs, query, collection, where, deleteDoc, OperationType, handleFirestoreError } from '../firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  instituteSettings: any;
  permissions: { [key: string]: boolean };
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
  const [instituteSettings, setInstituteSettings] = useState<any>(null);
  const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    let unsubscribeInst: (() => void) | undefined;
    let unsubscribeRole: (() => void) | undefined;

    // Real-time listener for institute settings
    try {
      unsubscribeInst = onSnapshot(doc(db, 'settings', 'institute'), (snap) => {
        if (snap.exists()) {
          setInstituteSettings({ id: snap.id, ...snap.data() });
          (window as any)._instituteLoaded = true;
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/institute');
      });
    } catch (e) {
      console.error('Failed to attach institute settings listener:', e);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          logger.auth('User Detected', { email: firebaseUser.email, uid: firebaseUser.uid });
          
          // Cleanup any existing listeners before starting new ones to avoid "Unexpected state" errors
          if (unsubscribeDoc) {
            unsubscribeDoc();
            unsubscribeDoc = undefined;
          }
          if (unsubscribeRole) {
            unsubscribeRole();
            unsubscribeRole = undefined;
          }
          
          // Use onSnapshot for real-time profile updates
          try {
            unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
              if (docSnap.exists()) {
                const profile = { ...docSnap.data(), uid: docSnap.id } as UserProfile;
                const isSuperAdminEmail = firebaseUser.email?.toLowerCase() === 'zeeshanmaqbool200@gmail.com';
                
                let needsUpdate = false;
                const updates: any = {};

                // Normalization and Bootstrap
                if (isSuperAdminEmail && (profile.role !== 'superadmin' && profile.role !== 'super_admin')) {
                  profile.role = 'superadmin';
                  updates.role = 'superadmin';
                  updates.isVerified = true;
                  needsUpdate = true;
                }

                if (profile.isVerified === undefined) {
                   profile.isVerified = isSuperAdminEmail;
                   updates.isVerified = isSuperAdminEmail;
                   needsUpdate = true;
                }

                if (!profile.role) {
                  profile.role = 'student';
                  updates.role = 'student';
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  updateDoc(doc(db, 'users', firebaseUser.uid), updates).catch(e => {
                    console.error('Initial profile update failed:', e);
                  });
                }
                
                setUser(profile);
                logger.success(`Profile updated for ${profile.displayName}`);
                
                // Fetch permissions
                if (isSuperAdminEmail) {
                  setPermissions({
                    view_dashboard: true,
                    manage_students: true,
                    manage_staff: true,
                    manage_fees: true,
                    manage_expenses: true,
                    manage_reports: true,
                    manage_exams: true,
                    manage_attendance: true,
                    system_settings: true,
                  });
                } else {
                  if (unsubscribeRole) unsubscribeRole();
                  try {
                    unsubscribeRole = onSnapshot(doc(db, 'roles', profile.role), (roleSnap) => {
                      if (roleSnap.exists()) {
                        setPermissions(roleSnap.data().permissions || {});
                      } else {
                        // Default permissions for fixed roles if no custom role found
                        const defaults: any = {
                          teacher: { view_dashboard: true, manage_attendance: true, manage_exams: true },
                          manager: { view_dashboard: true, manage_students: true, manage_fees: true, manage_expenses: true },
                          student: { view_dashboard: true }
                        };
                        setPermissions(defaults[profile.role] || {});
                      }
                    }, (error) => {
                      handleFirestoreError(error, OperationType.GET, `roles/${profile.role}`);
                    });
                  } catch (e) {
                    console.error('Failed to attach role listener:', e);
                  }
                }
              } else {
                // Try to find if user was pre-registered
                const findExisting = async () => {
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
                }).catch(err => {
                  console.error('Error in findExisting:', err);
                });
              }
              setLoading(false);
            }, (error) => {
              handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
              setLoading(false);
            });
          } catch (e) {
            console.error('Failed to attach user profile listener:', e);
            setLoading(false);
          }
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
      if (unsubscribeRole) unsubscribeRole();
      if (unsubscribeInst) unsubscribeInst();
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
      
      const finalRole = role === 'teacher' ? 'pending_teacher' : 'student';
      
      const newUser: UserProfile = {
        uid: firebaseUser.uid,
        email: email,
        displayName: name,
        role: finalRole as UserRole,
        isVerified: false, // All new users need verification
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
    user, loading, error, manualLogin, manualSignUp, logout, instituteSettings, permissions
  }), [user, loading, error, manualLogin, manualSignUp, logout, instituteSettings, permissions]);

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
