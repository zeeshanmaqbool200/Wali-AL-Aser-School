import localforage from 'localforage';
import { db } from '../firebase';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, 
  addDoc as firestoreAddDoc 
} from 'firebase/firestore';
import { logger } from './logger';

export enum ActionType {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SET = 'SET'
}

export interface QueuedAction {
  id: string;
  type: ActionType;
  collectionName: string;
  docId?: string;
  data: any;
  timestamp: number;
}

const QUEUE_KEY = 'edufee_sync_queue';

// Configure localforage
localforage.config({
  name: 'InstituteSyncQueue',
  storeName: 'offline_sync'
});

class SyncQueue {
  private isProcessing = false;

  async enqueue(action: Omit<QueuedAction, 'id' | 'timestamp'>) {
    const queue = await this.getQueue();
    const newAction: QueuedAction = {
      ...action,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now()
    };
    
    queue.push(newAction);
    await localforage.setItem(QUEUE_KEY, queue);
    
    logger.warn('Action saved offline', `${action.type} in ${action.collectionName}`);
    
    if (navigator.onLine) {
      this.processQueue();
    }
    
    return newAction.id;
  }

  async getQueue(): Promise<QueuedAction[]> {
    const queue = await localforage.getItem<QueuedAction[]>(QUEUE_KEY);
    return queue || [];
  }

  async clearQueue() {
    await localforage.setItem(QUEUE_KEY, []);
  }

  async processQueue() {
    if (this.isProcessing || !navigator.onLine) return;
    
    const queue = await this.getQueue();
    if (queue.length === 0) return;

    this.isProcessing = true;
    logger.info('Syncing offline data...', `Queue size: ${queue.length}`);

    const failedActions: QueuedAction[] = [];

    for (const action of queue) {
      try {
        const docRef = action.docId ? doc(db, action.collectionName, action.docId) : null;
        
        switch (action.type) {
          case ActionType.ADD:
            await firestoreAddDoc(collection(db, action.collectionName), action.data);
            break;
          case ActionType.UPDATE:
            if (docRef) await updateDoc(docRef, action.data);
            break;
          case ActionType.SET:
            if (docRef) await setDoc(docRef, action.data, { merge: true });
            break;
          case ActionType.DELETE:
            if (docRef) await deleteDoc(docRef);
            break;
        }
        logger.success('Synced successfully', `${action.type} -> ${action.collectionName}`);
      } catch (error) {
        logger.error('Sync failed for action', { action, error });
        failedActions.push(action);
      }
    }

    await localforage.setItem(QUEUE_KEY, failedActions);
    this.isProcessing = false;

    if (failedActions.length === 0) {
      // Trigger a custom event for components to listen to
      window.dispatchEvent(new CustomEvent('sync-complete'));
    }
  }
}

export const syncQueue = new SyncQueue();

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncQueue.processQueue();
  });
}
