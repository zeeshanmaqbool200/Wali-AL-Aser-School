import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, onSnapshot, doc, getDoc, setDoc, updateDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { logger } from '../lib/logger';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  manualLogin: (email: string, pass: string) => Promise<void>;
  manualSignUp: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
              const isAdminEmail = firebaseUser.email === 'zeeshanmaqbool200@gmail.com';
              if (isAdminEmail && profile.role !== 'superadmin') {
                profile.role = 'superadmin';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'superadmin' });
              }
              // Ensure role exists, default to student if missing
              if (!profile.role) {
                profile.role = 'student';
              }
              // Auto-approve mudaris if they were already teachers
              if ((profile.role as string) === 'teacher') {
                profile.role = 'approved_mudaris';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'approved_mudaris' });
              }
              if ((profile.role as string) === 'admin' && !isAdminEmail) {
                profile.role = 'pending_mudaris';
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'pending_mudaris' });
              }
              setUser(profile);
              setLoading(false);
              logger.success(`Profile Updated: ${profile.displayName} (${profile.role})`);
            } else {
              // Try to find if user was pre-registered by admin using email
              const findExistingByEmail = async () => {
                try {
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
                    
                    // Force superadmin role if it's the specific email
                    if (firebaseUser.email === 'zeeshanmaqbool200@gmail.com') {
                      newUser.role = 'superadmin';
                    }
                    
                    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                    
                    // Delete the old doc (id-less or with different ID)
                    if (existingDoc.id !== firebaseUser.uid) {
                      await deleteDoc(existingDoc.ref);
                      logger.info(`Merged pre-registered account: ${firebaseUser.email}`);
                    }
                    
                    setUser(newUser);
                    setLoading(false);
                    return true;
                  }
                  return false;
                } catch (err) {
                  logger.error('findExistingByEmail error', err);
                  return false;
                }
              };

              findExistingByEmail().then((found) => {
                if (!found) {
                  // Bootstrap new user
                  const isAdminEmail = firebaseUser.email === 'zeeshanmaqbool200@gmail.com';
                  const newUser: UserProfile = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    displayName: firebaseUser.displayName || 'User',
                    role: isAdminEmail ? 'superadmin' : (firebaseUser.displayName?.toLowerCase().includes('teacher') ? 'pending_mudaris' : 'student'),
                    createdAt: Date.now(),
                    photoURL: firebaseUser.photoURL || undefined,
                  };
                  setDoc(doc(db, 'users', firebaseUser.uid), newUser).then(() => {
                    setUser(newUser);
                    setLoading(false);
                    logger.success('New User Profile Created', newUser);
                  });
                }
              }).catch(err => {
                logger.error('Failed to merge pre-registered account', err);
                setLoading(false);
              });
            }
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

  const manualLogin = async (email: string, pass: string) => {
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
  };

  const manualSignUp = async (email: string, pass: string, name: string, role: UserRole) => {
    try {
      setError(null);
      logger.auth('Attempting Manual Sign Up', { email, name, role });
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      // Bootstrap the user's email as a superadmin
      const finalRole = firebaseUser.email === 'zeeshanmaqbool200@gmail.com' ? 'superadmin' : (role === ('teacher' as any) ? 'pending_mudaris' : role);
      
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
  };

  const logout = async () => {
    try {
      logger.auth('Attempting Logout');
      await signOut(auth);
      logger.success('Logout Successful');
    } catch (err) {
      logger.error('Logout Failed', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, manualLogin, manualSignUp, logout }}>
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
