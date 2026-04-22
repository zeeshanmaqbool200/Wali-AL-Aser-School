import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp, getDoc } from '../firebase';
import { Attendance, ClassSchedule, Note, FeeReceipt, UserProfile } from '../types';

// Users
export const subscribeToUsers = (callback: (users: UserProfile[]) => void) => {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
    callback(users);
  });
};

// Attendance
export const markAttendance = async (attendanceData: Omit<Attendance, 'id'>) => {
  return addDoc(collection(db, 'attendance'), {
    ...attendanceData,
    markedAt: Date.now()
  });
};

export const subscribeToAttendance = (studentId: string, callback: (attendance: Attendance[]) => void) => {
  const q = query(collection(db, 'attendance'), where('studentId', '==', studentId));
  return onSnapshot(q, (snapshot) => {
    const attendance = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attendance));
    callback(attendance);
  });
};

// Schedule
export const addSchedule = async (scheduleData: Omit<ClassSchedule, 'id'>) => {
  return addDoc(collection(db, 'schedules'), scheduleData);
};

export const subscribeToSchedule = (callback: (schedule: ClassSchedule[]) => void) => {
  return onSnapshot(collection(db, 'schedules'), (snapshot) => {
    const schedule = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClassSchedule));
    callback(schedule);
  });
};

// Notes
export const uploadNote = async (noteData: Omit<Note, 'id'>) => {
  return addDoc(collection(db, 'notes'), {
    ...noteData,
    uploadedAt: Date.now()
  });
};

export const subscribeToNotes = (callback: (notes: Note[]) => void) => {
  return onSnapshot(collection(db, 'notes'), (snapshot) => {
    const notes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Note));
    callback(notes);
  });
};

// Fees
export const createFeeReceipt = async (receiptData: Omit<FeeReceipt, 'id'>) => {
  return addDoc(collection(db, 'fee_receipts'), {
    ...receiptData,
    status: 'pending'
  });
};

export const approveFeeReceipt = async (receiptId: string, adminId: string) => {
  const receiptRef = doc(db, 'fee_receipts', receiptId);
  return updateDoc(receiptRef, {
    status: 'approved',
    approvedBy: adminId,
    approvedAt: Date.now()
  });
};

export const subscribeToFeeReceipts = (callback: (receipts: FeeReceipt[]) => void) => {
  return onSnapshot(collection(db, 'fee_receipts'), (snapshot) => {
    const receipts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FeeReceipt));
    callback(receipts);
  });
};
