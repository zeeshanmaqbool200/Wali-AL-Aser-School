/**
 * Professional Styled Logger for Idarah Wali Ul Aser
 * Uses CSS styling in console for better developer experience and professionality.
 */

import { addDoc, collection, Firestore } from 'firebase/firestore';
import { UAParser } from 'ua-parser-js';
import { getAuth } from 'firebase/auth';

const BRAND_COLOR = '#0d9488'; // Primary Teal
const APP_VERSION = '2.2.0-gold';

const getIslamicDate = () => {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-uma-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  } catch (e) {
    return new Date().toLocaleDateString();
  }
};

const getTimestamp = () => new Date().toLocaleTimeString();

const INFO_COLOR = '#3b82f6';
const WARN_COLOR = '#f59e0b';

let firestoreDb: Firestore | null = null;
const parser = new UAParser();

export const initLoggerDb = (db: Firestore) => {
  firestoreDb = db;
  // Print initial beautiful header only once
  console.log(
    `%c Institute Wali Ul Aser V${APP_VERSION} %c ${getIslamicDate()} %c ${new Date().toLocaleDateString()} `,
    `background: ${BRAND_COLOR}; color: white; border-radius: 4px; padding: 4px 8px; font-weight: 900; font-size: 1.1rem;`,
    'background: #111827; color: #fbbf24; border-radius: 4px; padding: 4px 8px; font-weight: 700;',
    'color: #6b7280; font-size: 0.9rem; font-weight: 500;'
  );
};

const saveLogToDb = async (level: string, message: string, data?: any) => {
  if (!firestoreDb) return;
  try {
    // Detailed User Agent Info
    const result = parser.getResult();
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    // IP and Location placeholder (since we can't do direct IP lookups easily without external services)
    // We'll use a public API for location if it's a critical log
    let location = 'Session';
    let ip = 'Logged';

    const logData: any = {
      level,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : null,
      timestamp: Date.now(),
      islamicDate: getIslamicDate(),
      userAgent: navigator.userAgent,
      ip,
      location,
      browser: result.browser.name || 'Unknown',
      os: result.os.name || 'Unknown',
      device: result.device.model || 'Desktop',
      engine: result.engine.name || 'Unknown',
      cpu: result.cpu.architecture || 'Unknown',
      userId: currentUser?.uid || 'anonymous',
      userEmail: currentUser?.email || 'anonymous',
    };

    // If it's a security or access related event, Error, or Auth - use access_logs
    if (level === 'error' || level === 'auth' || message.toLowerCase().includes('access') || message.toLowerCase().includes('login') || message.toLowerCase().includes('permission')) {
      await addDoc(collection(firestoreDb, 'access_logs'), logData);
    } else {
      await addDoc(collection(firestoreDb, 'system_logs'), logData);
    }
  } catch (e) {
    // Fail silently to avoid infinite loops
  }
};

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  info: (message: string, data?: any) => {
    // Only log to console if it's not a noisy repeating log
    if (isDev && !message.includes('Loading') && !message.includes('Active')) {
      console.log(
        `%c ℹ️ INFO %c [${getTimestamp()}] %c ${message}`,
        `background: ${INFO_COLOR}; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
        'color: #6b7280; font-size: 0.8rem;',
        'color: #1f2937; font-weight: 500;'
      );
    }
    saveLogToDb('info', message, data);
  },

  success: (message: string, data?: any) => {
    if (isDev) {
      console.log(
        `%c ✅ SUCCESS %c [${getTimestamp()}] %c ${message}`,
        `background: ${BRAND_COLOR}; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
        'color: #6b7280; font-size: 0.8rem;',
        'color: #065f46; font-weight: 600;'
      );
    }
    saveLogToDb('success', message, data);
  },

  warn: (message: string, data?: any) => {
    if (isDev) {
      console.warn(
        `%c ⚠️ WARN %c [${getTimestamp()}] %c ${message}`,
        `background: ${WARN_COLOR}; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
        'color: #6b7280; font-size: 0.8rem;',
        'color: #92400e; font-weight: 500;'
      );
    }
    saveLogToDb('warn', message, data);
  },

  error: (message: string, data?: any) => {
    // Always log errors to console but sanitize data
    const ERROR_COLOR = '#ef4444';
    console.error(
      `%c 🚨 ERROR %c [${getTimestamp()}] %c ${message}`,
      `background: ${ERROR_COLOR}; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
      'color: #6b7280; font-size: 0.8rem;',
      'color: #991b1b; font-weight: 600;'
    );
    
    saveLogToDb('error', message, data);
  },

  db: (operation: string, path: string, data?: any) => {
    // Quiet Firestore logs in console unless there's a specific interesting operation (writes/deletes)
    if (isDev && (operation.toLowerCase() === 'add' || operation.toLowerCase() === 'update' || operation.toLowerCase() === 'delete')) {
      console.log(
        `%c 🔥 FIRESTORE %c [${getTimestamp()}] %c ${operation.toUpperCase()} %c ${path}`,
        `background: #ff6000; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
        'color: #6b7280; font-size: 0.8rem;',
        'color: #ff6000; font-weight: 800;',
        'color: #4b5563; font-family: monospace;'
      );
    }
    saveLogToDb('db', `${operation}: ${path}`, data);
  },

  auth: (event: string, user?: any) => {
    if (isDev) {
      console.log(
        `%c 🔐 AUTH %c [${getTimestamp()}] %c ${event}`,
        `background: #6366f1; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
        'color: #6b7280; font-size: 0.8rem;',
        'color: #4338ca; font-weight: 700;'
      );
    }
    saveLogToDb('auth', event, user);
  }
};

// Listen for unhandled rejections to catch Firestore INTERNAL ASSERTION FAILED errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || '';
    if (message?.includes('FIRESTORE') || message?.includes('INTERNAL ASSERTION FAILED')) {
       // Log the error for debugging
       logger.error('CRITICAL FIRESTORE ERROR INTERCEPTED', {
         message,
         stack: event.reason?.stack,
         ve: message.match(/"ve":(-?\d+)/)?.[1]
       });
       
       // Force a refresh if it's a fatal internal state error that happens repeatedly
       if (message.includes('ID: ca9')) {
         console.warn('Recovering from Firestore internal state error...');
         // Consider debounced reload if it keeps happening
       }
    }
  });
}
