export type UserRole = 'student' | 'superadmin' | 'muntazim' | 'mudaris' | 'pending_mudaris';
export type MaktabLevel = 'Awal' | 'Doum' | 'Soam' | 'Chaharum' | 'panjum' | 'shahsum' | 'haftum' | 'hashtum' | 'dahum' | 'Hafiz' | 'muntazim [m]' | 'muntazimah [f]';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  dob?: string;
  createdAt: number;
  phone?: string;
  whatsapp?: string;
  address?: string;
  // Tulab specific
  studentId?: string; // Admission No.
  admissionNo?: string;
  grade?: string; // Maktab Level
  maktabLevel?: MaktabLevel;
  pendingMaktabLevel?: MaktabLevel;
  fatherName?: string;
  motherName?: string;
  rollNo?: string;
  contactNumber?: string;
  admissionDate?: string;
  status?: 'Active' | 'Inactive';
  subjectsEnrolled?: string[];
  haziriStatus?: string; // Summary
  enrolledCourses?: string[];
  // Mudaris specific
  teacherId?: string;
  subject?: string;
  expertise?: string[];
  assignedClasses?: string[];
  notificationPrefs?: {
    email: boolean;
    push: boolean;
    feeReminders: boolean;
    attendance: boolean;
    announcements: boolean;
    inAppToasts: boolean;
  };
  uiPrefs?: {
    highContrast: boolean;
    reduceMotion: boolean;
    compactLayout: boolean;
    accentColor?: string;
  };
  hardwareStatus?: {
    notifications: 'granted' | 'denied' | 'prompt' | 'not-supported';
    camera: 'granted' | 'denied' | 'prompt' | 'not-supported';
    microphone: 'granted' | 'denied' | 'prompt' | 'not-supported';
    lastUpdated: string;
  };
}

export interface Attendance {
  id: string;
  studentId: string;
  studentName: string;
  maktabLevel: string;
  subjects: string[];
  date: string; // ISO string (YYYY-MM-DD)
  status: 'present' | 'absent' | 'leave';
  markedBy: string; // Mudaris UID
  markedByName?: string;
  markedAt: number;
}

export interface ClassSchedule {
  id: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  dayOfWeek: number; // 0-6
  room: string;
  grade: string; // Maktab Level
  description?: string;
  materials?: {
    title: string;
    url: string;
    type: 'pdf' | 'text' | 'link';
  }[];
}

export interface Note {
  id: string;
  title: string;
  description: string;
  fileUrl?: string;
  uploadedBy: string; // Mudaris UID
  uploadedAt: number;
  subject: string;
  grade: string; // Maktab Level
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface QuizData {
  questions: QuizQuestion[];
  passingScore: number;
}

export interface QuizAttempt {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  submittedAt: number;
  answers: number[];
}

export interface CourseSection {
  id?: string;
  order?: number;
  title: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'quiz' | 'file' | 'audio';
  mediaUrl?: string;
  quizData?: QuizData;
  quizAttempts?: QuizAttempt[];
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  teacherId: string;
  teacherName: string;
  credits: number;
  duration: string;
  fee: number;
  createdAt: number;
  thumbnailUrl?: string;
  sections?: CourseSection[];
  enrolledStudents?: string[]; // Array of student UIDs
  assignedMudaris?: string[]; // Array of mudaris UIDs
  gradeId?: string; // Maktab level it's targeted for
  isPublished?: boolean;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  grade: string;
  studentId: string;
  enrolledCourses: string[]; // Course IDs
  createdAt: number;
}

export interface FeeReceipt {
  id: string;
  receiptNumber: string; // INST-2026-000045
  receiptNo?: string;
  studentId: string;
  studentOfficialId?: string; // N21E5... or Admission No
  studentName: string;
  fatherName?: string;
  grade: string; // Maktab Level
  amount: number;
  feeHead: 'Monthly Fee' | 'Admission Fee' | 'Quran / Hifz Fee' | 'Exam / Test Fee' | 'Book / Kitab Fee' | 'Activity / Competition Fee (Gez-z & Gen-x)' | 'Sadqa / Donation' | 'Others';
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Cheque' | 'Others';
  transactionId?: string;
  date: string; // YYYY-MM-DD
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  studentPhotoURL?: string;
  createdAt: number;
  createdBy: string; // UID
  approvedBy?: string; // Mudaris UID
  approvedByName?: string;
  approvedAt?: number;
  uploadedBy?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'fee_request' | 'class_timing' | 'announcement' | 'general';
  targetType: 'individual' | 'class' | 'all';
  targetId?: string; // UID or Class Name
  senderId: string;
  senderName: string;
  createdAt: number;
  readBy: string[]; // Array of UIDs
}

export interface InstituteSettings {
  id: string;
  name: string;
  maktabName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  mission: string;
  founded: string;
  greeting: string;
  team: {
    chairman: string;
    financeManager: string;
    supervisor: string;
    organizer: string;
    secretary: string;
    mediaConsultant: string;
    socialMediaManager: string;
    mediaIncharge: string;
  };
  logo?: string;
  logoUrl?: string;
  bannerUrl?: string;
  receiptLeftImageUrl?: string;
  receiptRightImageUrl?: string;
  receiptPrefix: string;
  primaryColor: string;
  secondaryColor: string;
  jafariOffset?: number;
}
