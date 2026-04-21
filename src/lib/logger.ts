/**
 * Professional Styled Logger for Idarah Wali Ul Aser
 * Uses CSS styling in console for better developer experience and professionality.
 */

import { addDoc, collection, Firestore } from 'firebase/firestore';
import { UAParser } from 'ua-parser-js';

const BRAND_COLOR = '#0d9488'; // Primary Teal
const APP_VERSION = '2.1.0-gold';

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
    `%c EduFee Track V${APP_VERSION} %c ${getIslamicDate()} %c ${new Date().toLocaleDateString()} `,
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
    
    // IP address
    let ip = 'Unknown';
    let location = 'Unknown';
    try {
      // Use a faster IP service that also gives some geo info if possible
      const response = await fetch('https://ipapi.co/json/');
      const json = await response.json();
      ip = json.ip;
      location = `${json.city}, ${json.region}, ${json.country_name}`;
    } catch (e) {
      // Fallback
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const json = await response.json();
        ip = json.ip;
      } catch (e) {}
    }

    const logData = {
      level,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : null,
      timestamp: Date.now(),
      islamicDate: getIslamicDate(),
      userAgent: navigator.userAgent,
      ip,
      location,
      browser: result.browser,
      os: result.os,
      device: result.device,
      engine: result.engine,
      cpu: result.cpu
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
    if (isDev) {
      console.log(
        `%c ℹ️ INFO %c [${getTimestamp()}] %c ${message}`,
        `background: ${INFO_COLOR}; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
        'color: #6b7280; font-size: 0.8rem;',
        'color: #1f2937; font-weight: 500;',
        data || ''
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
        'color: #065f46; font-weight: 600;',
        data || ''
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
        'color: #92400e; font-weight: 500;',
        data || ''
      );
    }
    saveLogToDb('warn', message, data);
  },

  error: (message: string, data?: any) => {
    // Always log errors to console but sanitize data in prod
    const ERROR_COLOR = '#ef4444';
    console.error(
      `%c 🚨 ERROR %c [${getTimestamp()}] %c ${message}`,
      `background: ${ERROR_COLOR}; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
      'color: #6b7280; font-size: 0.8rem;',
      'color: #991b1b; font-weight: 600;'
    );
    
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log('%c Debug Info:', 'color: #9ca3af; font-weight: bold;', data || '');
    }
    
    saveLogToDb('error', message, data);
  },

  db: (operation: string, path: string, data?: any) => {
    if (isDev) {
      console.log(
        `%c 🔥 FIRESTORE %c [${getTimestamp()}] %c ${operation.toUpperCase()} %c ${path}`,
        `background: #ff6000; color: white; border-radius: 4px; padding: 2px 6px; font-weight: bold;`,
        'color: #6b7280; font-size: 0.8rem;',
        'color: #ff6000; font-weight: 800;',
        'color: #4b5563; font-family: monospace;',
        data || ''
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
        'color: #4338ca; font-weight: 700;',
        user || ''
      );
    }
    saveLogToDb('auth', event, user);
  }
};
