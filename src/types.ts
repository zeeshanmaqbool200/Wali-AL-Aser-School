export type UserRole = 'student' | 'admin' | 'superadmin' | 'super_admin' | 'manager' | 'teacher' | 'pending_teacher' | 'pending_student' | 'mudeer' | 'mudaris' | 'muntazim';
export type ClassLevel = 'Mubtadi' | 'Awal' | 'Doum' | 'Soum' | 'Chaharm' | 'Panjum' | 'Shasham' | 'Haftum' | 'Hashtum' | 'Nahum' | 'Dahum' | 'Hafiz' | 'Manager [m]' | 'Manager [f]';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isVerified?: boolean;
  photoURL?: string;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  createdAt: number;
  updatedAt?: number;
  phone?: string;
  whatsapp?: string;
  address?: string;
  qualifications?: string;
  managerId?: string;
  // Student specific
  studentId?: string; // Admission No.
  admissionNo?: string;
  classLevel?: string;
  pendingClassLevel?: ClassLevel;
  fatherName?: string;
  motherName?: string;
  rollNo?: string;
  contactNumber?: string;
  admissionDate?: string;
  status?: 'Active' | 'Inactive' | 'Archived' | 'Pending' | 'Deleted' | 'Banned';
  removedAt?: any;
  removedBy?: string;
  subjectsEnrolled?: string[];
  attendanceStatus?: string; // Summary
  enrolledCourses?: string[];
  // Teacher specific
  teacherId?: string;
  subject?: string;
  staffId?: string;
  profession?: string;
  expertise?: string[];
  pendingProfileChanges?: {
    profession?: string;
    expertise?: string[];
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: number;
  };
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
    navPreference?: 'bottom' | 'side';
  };
  hardwareStatus?: {
    notifications: 'granted' | 'denied' | 'prompt' | 'not-supported';
    camera: 'granted' | 'denied' | 'prompt' | 'not-supported';
    microphone: 'granted' | 'denied' | 'prompt' | 'not-supported';
    lastUpdated: string;
  };
  editHistory?: {
    timestamp: number;
    modifiedBy: string;
    action: string;
  }[];
  quizScores?: {
    courseId: string;
    sectionId: string;
    score: number;
    total: number;
    timestamp: number;
  }[];
  certificates?: Certificate[];
  readingProgress?: Record<string, {
    lastSectionId: string;
    lastPosition: number;
    completedAt?: number;
    updatedAt: number;
  }>;
  engagementMetrics?: {
    totalMinutes: number;
    lastActiveAt: number;
    lessonsCompleted: number;
    quizAverage: number;
    streak?: number;
    dailyMinutes?: Record<string, number>; // Historical record of minutes spent per day
  };
}

export interface Attendance {
  id: string;
  studentId: string;
  studentName: string;
  classLevel: string;
  subjects: string[];
  date: string; // ISO string (YYYY-MM-DD)
  status: 'present' | 'absent' | 'leave';
  markedBy: string; // Teacher UID
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
  classLevel: string;
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
  uploadedBy: string; // Teacher UID
  uploadedAt: number;
  subject: string;
  classLevel: string;
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
  answers: any[];
  completionTimeSeconds?: number;
  attempts?: number;
  wrongAnswersIds?: string[];
  performanceAnalytics?: {
    accuracy: number;
    topicBreakdown?: Record<string, number>;
  };
}

export interface CourseSection {
  id: string;
  order: number;
  title: string;
  content: string; // Markdown or plain text
  type: 'text' | 'image' | 'video' | 'quiz' | 'file' | 'audio' | 'callout' | 'quote' | 'code' | 'gallery' | 'pdf' | 'bookmark' | 'divider' | 'flashcard';
  mediaUrl?: string;
  audioUrl?: string; // Dedicated for audiobook experiences
  mediaItems?: string[]; // For gallery
  quizData?: QuizData;
  quizAttempts?: QuizAttempt[];
  fontFamily?: 'default' | 'serif' | 'nastaliq' | 'mono' | 'urdu-modern' | 'ebook-serif' | 'display-playfair' | 'premium-serif' | 'modern-sans' | 'classic-book';
  alignment?: 'left' | 'center' | 'right' | 'justify';
  isRTL?: boolean;
  fontSize?: 'small' | 'medium' | 'large' | 'extra-large' | 'massive';
  secondaryMediaUrl?: string;
  secondaryMediaType?: 'audio' | 'video';
  layout?: 'standard' | 'ebook' | 'blog' | 'magazine' | 'audio-immersive' | 'video-lesson' | 'study-sheet';
  theme?: {
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
    fontPairing?: 'default' | 'premium-serif' | 'modern-sans' | 'classic-book';
    backgroundTextureUrl?: string;
    paperTexture?: boolean;
  };
  metadata?: {
    estimatedReadTime?: number;
    audioDuration?: number;
    calloutType?: 'info' | 'warning' | 'error' | 'success' | 'tip';
    quoteAuthor?: string;
    codeLanguage?: string;
    flashcardBack?: string;
    quizQuestions?: {
      q: string;
      options: string[];
      correct: number;
      explanation?: string;
    }[];
  };
  metrics?: {
    views: number;
    uniqueReaders: number;
    completions: number;
    avgTimeSeconds: number;
    audioListenCompletions: number;
  };
}

export interface Certificate {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  issueDate: number;
  issuedBy: string;
  certificateNumber: string;
  template: 'classic' | 'premium' | 'islamic';
  status: 'pending' | 'approved' | 'revoked';
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
  updatedAt: number;
  thumbnailUrl?: string;
  bannerUrl?: string; // Cinematic header
  sections?: CourseSection[];
  enrolledStudents?: string[]; 
  assignedTeachers?: string[]; 
  classLevelId?: string; 
  isPublished?: boolean;
  views?: number;
  category?: string;
  averageRating?: number;
  totalLessons?: number;
  totalDurationMinutes?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  metrics?: {
    totalViews: number;
    uniqueReaders: number;
    completionCount: number;
    avgReadingMinutes: number;
    quizParticipation: number;
    lastAccessedAt: number;
  };
  ownerId: string; // Teacher or Admin UID
  activeUsers?: { uid: string, lastSeen: number }[]; // For "currently reading"
}

export interface Student {
  id: string;
  name: string;
  email: string;
  classLevel: string;
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
  classLevel: string;
  amount: number;
  feeHead: 'Monthly Fee' | 'Admission Fee' | 'Quran / Hifz Fee' | 'Exam / Test Fee' | 'Book Fee' | 'Activity / Competition Fee (Gez-z & Gen-x)' | 'Sadqa / Donation' | 'Others';
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Cheque' | 'Others';
  transactionId?: string;
  month?: string;
  date: string; // YYYY-MM-DD
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  studentPhotoURL?: string;
  createdAt: number;
  createdBy: string; // UID
  createdByName?: string;
  approvedBy?: string; // Teacher UID
  approvedByName?: string;
  approvedAt?: number;
  uploadedBy?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'fee_request' | 'class_timing' | 'announcement' | 'general' | 'form_assignment';
  targetType: 'individual' | 'class' | 'all';
  targetId?: string; // UID or Class Name
  senderId: string;
  senderName: string;
  createdAt: number;
  readBy: string[]; // Array of UIDs
  hiddenBy?: string[]; // Array of UIDs who dismissed/deleted this notification
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  imageUrl?: string;
  formId?: string; // Link to a form
}

export interface FormQuestion {
  id: string;
  type: 'text' | 'paragraph' | 'multiple_choice' | 'checkbox' | 'dropdown' | 'date' | 'time' | 'number';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For multiple choice, checkbox, dropdown
  correctAnswer?: string | string[]; // For exams
  points?: number;
}

export interface FormSchema {
  id: string;
  title: string;
  description: string;
  type: 'exam' | 'survey' | 'registration';
  status: 'draft' | 'published' | 'closed';
  
  // Timing & Access
  startDate?: number;
  endDate?: number;
  durationLimit?: number; // In minutes
  
  // Visibility
  allowNonStudents: boolean;
  anonymous?: boolean;
  
  // Branding
  logoUrl?: string; // Custom logo for this form
  bannerUrl?: string; // High-resolution banner image
  primaryColor?: string; // Custom accent for this form
  headerLeftImageUrl?: string; // Branding Left image
  headerRightImageUrl?: string; // Branding Right image
  
  // Logic
  showProgressBar?: boolean;
  limitOneResponse?: boolean;
  collectEmail?: boolean;
  collectRollNo?: boolean;
  collectName?: boolean;
  
  questions: FormQuestion[];
  resultsPublished?: boolean;
  
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number; department?: string; // For Admin-level filtering
}

export interface FormResponse {
  id: string;
  formId: string;
  userId?: string; // If logged in
  userEmail?: string;
  userName?: string;
  userRollNo?: string;
  ipAddress: string;
  
  responses: {
    questionId: string;
    answer: any;
    isCorrect?: boolean; // For auto-graded exams
    score?: number;
  }[];
  
  totalScore?: number;
  submittedAt: number;
  isDuplicate?: boolean; // System flagged
  browserInfo?: string;
  isAutoSubmit?: boolean;
}

export interface InstituteSettings {
  id: string;
  name: string;
  instituteName: string;
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
  stampUrl?: string;
  leftImageUrl?: string;
  rightImageUrl?: string;
  receiptPrefix: string;
  primaryColor: string;
  secondaryColor: string;
  accentColors?: string[]; // 4 accent colors
  holidays?: string[]; // Array of YYYY-MM-DD strings
  announcementBgColor?: string;
  announcementTextColor?: string;
  jafariOffset?: number;
  quotes?: string[];
  navPreference?: 'bottom' | 'side';
  portalSettings?: {
    student: {
      showDashboardStats: boolean;
      showQuickActions: boolean;
      showEnrolledSubjects: boolean;
      showNotifications: boolean;
    };
    teacher: {
       showRevenueStats: boolean;
       showAttendanceStats: boolean;
       showPendingActions: boolean;
       allowProfileEdit: boolean;
    };
    manager: {
       showFinancialHealth: boolean;
       showQuickActions: boolean;
       enableAuditLogs: boolean;
    };
  };
}
