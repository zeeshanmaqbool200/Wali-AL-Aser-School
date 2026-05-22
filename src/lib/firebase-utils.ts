import { 
  db, 
  auth 
} from '../firebase';
import { 
  doc, 
  writeBatch, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In production we usually don't want to leak JSON to users, 
  // but for this specific request we keep it as a structured log
  return errInfo;
}

/**
 * Cascading delete for a user/student
 * Removes user doc AND all associated records in receipts, attendance, quiz_results, notifications
 */
export async function deleteUserPermanently(userId: string) {
  if (!userId) return;
  
  const batch = writeBatch(db);
  
  try {
    // 1. Queue user deletion
    batch.delete(doc(db, 'users', userId));
    
    // 2. Fetch and queue related document deletions
    const collectionsToCleanup = [
      { name: 'receipts', field: 'studentId' },
      { name: 'attendance', field: 'studentId' },
      { name: 'quiz_results', field: 'userId' },
      { name: 'notifications', field: 'userId' },
      { name: 'forms_responses', field: 'userId' }
    ];
    
    for (const col of collectionsToCleanup) {
      const q = query(collection(db, col.name), where(col.field, '==', userId));
      const snap = await getDocs(q);
      snap.forEach(d => batch.delete(d.ref));
    }
    
    await batch.commit();
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId} (cascade)`);
    throw error;
  }
}

/**
 * Log an administrative action
 */
export async function logAdminAction(adminId: string, action: string, targetId: string, details: string) {
  try {
    const logRef = doc(collection(db, 'admin_logs'));
    const logData = {
      adminId,
      action,
      targetId,
      details,
      timestamp: Timestamp.now()
    };
    // Standardizing on batch for consistency if needed, but simple add works
    const batch = writeBatch(db);
    batch.set(logRef, logData);
    await batch.commit();
  } catch (e) {
    console.warn('Failed to log admin action:', e);
  }
}
