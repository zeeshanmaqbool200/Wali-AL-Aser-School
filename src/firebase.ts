import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  initializeFirestore, doc, getDoc, setDoc, collection, query, where, 
  onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, 
  memoryLocalCache
} from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';
export { firebaseConfig };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with optimized settings for the specific build environment
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  ignoreUndefinedProperties: true
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

// Initialize logger with db
initLoggerDb(db);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

import { logger, initLoggerDb } from './lib/logger';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  // Check for rate limit or quota issues
  if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('resource-exhausted') || errorMsg.includes('Rate exceeded')) {
    const event = new CustomEvent('firestore-rate-limit', { detail: { error: errorMsg } });
    window.dispatchEvent(event);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  logger.error(`Firestore ${operationType.toUpperCase()} Failed`, {
    path,
    error: errInfo.error,
    auth: errInfo.authInfo
  });
  
  throw new Error(JSON.stringify(errInfo));
}

import { syncQueue, ActionType } from './lib/syncQueue';

export async function smartAddDoc(collectionRef: any, data: any) {
  if (navigator.onLine) {
    try {
      return await addDoc(collectionRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionRef.path || collectionRef.id);
    }
  } else {
    return syncQueue.enqueue({
      type: ActionType.ADD,
      collectionName: collectionRef.id,
      data
    });
  }
}

export async function smartUpdateDoc(docRef: any, data: any) {
  if (navigator.onLine) {
    try {
      return await updateDoc(docRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docRef.path);
    }
  } else {
    return syncQueue.enqueue({
      type: ActionType.UPDATE,
      collectionName: docRef.parent.id,
      docId: docRef.id,
      data
    });
  }
}

export async function smartSetDoc(docRef: any, data: any, options: any = {}) {
  if (navigator.onLine) {
    try {
      return await setDoc(docRef, data, options);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docRef.path);
    }
  } else {
    return syncQueue.enqueue({
      type: ActionType.SET,
      collectionName: docRef.parent.id,
      docId: docRef.id,
      data
    });
  }
}

export async function smartDeleteDoc(docRef: any) {
  if (navigator.onLine) {
    try {
      return await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docRef.path);
    }
  } else {
    return syncQueue.enqueue({
      type: ActionType.DELETE,
      collectionName: docRef.parent.id,
      docId: docRef.id,
      data: null
    });
  }
}

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  getDocs
};
