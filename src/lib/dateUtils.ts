import { format } from 'date-fns';

/**
 * Safely format a date value from various formats (number, string, Firestore Timestamp, Date object)
 * Returns 'N/A' if the date is invalid or missing.
 */
export const safelyFormatDate = (dateVal: any, formatStr: string = 'dd MM yyyy') => {
  if (!dateVal) return 'N/A';
  try {
    let d;
    // Check for Firestore Timestamp
    if (typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
      d = dateVal.toDate();
    } 
    // Check for number (ms) or string (date string)
    else if (typeof dateVal === 'number' || typeof dateVal === 'string') {
      d = new Date(dateVal);
    } 
    // Already a Date object or other
    else {
      d = dateVal;
    }
    
    if (!(d instanceof Date) || isNaN(d.getTime())) return 'N/A';
    return format(d, formatStr);
  } catch (e) {
    return 'N/A';
  }
};
