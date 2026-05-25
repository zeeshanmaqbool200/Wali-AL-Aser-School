import { db, auth } from '../firebase';
import { 
  doc, 
  updateDoc, 
  increment, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';

export const trackCourseView = async (courseId: string) => {
  const user = auth.currentUser;
  if (!user) return;

  const courseRef = doc(db, 'courses', courseId);
  const userRef = doc(db, 'users', user.uid);
  
  try {
    // 1. Increment total views
    await updateDoc(courseRef, {
      'metrics.totalViews': increment(1),
      lastAccessedAt: serverTimestamp(),
      'activeUsers': arrayUnion({
        uid: user.uid,
        lastSeen: Date.now()
      })
    });

    // 2. Track unique reader in course
    const courseSnap = await getDoc(courseRef);
    const readers = courseSnap.data()?.uniqueReaderIds || [];
    if (!readers.includes(user.uid)) {
      await updateDoc(courseRef, {
        uniqueReaderIds: arrayUnion(user.uid),
        'metrics.uniqueReaders': increment(1)
      });
    }

    // 3. Update user engagement streak/minutes
    await updateDoc(userRef, {
      'engagementMetrics.lastActiveAt': Date.now()
    });

  } catch (error) {
    console.error('Analytics track error:', error);
  }
};

export const updateEngagementTime = async (courseId: string, seconds: number) => {
  const user = auth.currentUser;
  if (!user) return;

  const courseRef = doc(db, 'courses', courseId);
  const userRef = doc(db, 'users', user.uid);

  try {
    await updateDoc(userRef, {
      'engagementMetrics.totalMinutes': increment(seconds / 60)
    });
    
    // Periodically update active status in course
    await updateDoc(courseRef, {
      activeUsers: arrayUnion({ uid: user.uid, lastSeen: Date.now() })
    });
  } catch (error) {
    console.error('Engagement time update error:', error);
  }
};

export const markLessonComplete = async (courseId: string, sectionId: string) => {
  const user = auth.currentUser;
  if (!user) return;

  const courseRef = doc(db, 'courses', courseId);
  const userRef = doc(db, 'users', user.uid);

  try {
    // Increment completion on course
    await updateDoc(courseRef, {
      'metrics.completionCount': increment(1)
    });

    // Track on user profile
    await updateDoc(userRef, {
      [`readingProgress.${courseId}.sectionsCompleted`]: arrayUnion(sectionId),
      'engagementMetrics.lessonsCompleted': increment(1)
    });
  } catch (error) {
    console.error('Lesson completion error:', error);
  }
};

export const cleanupActiveUser = async (courseId: string) => {
  const user = auth.currentUser;
  if (!user) return;

  const courseRef = doc(db, 'courses', courseId);
  try {
    const snap = await getDoc(courseRef);
    const activeUsers = snap.data()?.activeUsers || [];
    const me = activeUsers.find((u: any) => u.uid === user.uid);
    if (me) {
      await updateDoc(courseRef, {
        activeUsers: arrayRemove(me)
      });
    }
  } catch (e) {}
};
