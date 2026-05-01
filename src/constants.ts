export const CLASS_LEVELS = [
  'Mubtadi', 'Awal', 'Doum', 'Soum', 'Chaharam', 'Panjam', 'Shasham', 'Haftam', 'Hashtam', 'Nuhum', 'Dahum',
  'Hafiz', 'Manager [m]', 'Manager [f]'
] as const;

export const FEE_HEADS = [
  'Monthly Fee', 'Admission Fee', 'Quran / Hifz Fee', 
  'Exam / Test Fee', 'Book Fee', 
  'Activity / Competition Fee', 
  'Donation', 'Zakat', 'Khums', 'Maal-e-Imam', 'Niyaz', 'Chutki Fund', 'Others'
] as const;

export const EXPENSE_CATEGORIES = [
  { value: 'materials', label: 'Materials', color: '#0f766e' },
  { value: 'utilities', label: 'Utilities', color: '#0369a1' },
  { value: 'salaries', label: 'Salaries', color: '#7e22ce' },
  { value: 'maintenance', label: 'Maintenance', color: '#be185d' },
  { value: 'books', label: 'Books', color: '#8b5cf6' },
  { value: 'branding', label: 'Banners/Flags/Posters', color: '#ec4899' },
  { value: 'niyaz', label: 'Niyaz', color: '#f59e0b' },
  { value: 'chutki', label: 'Chutki Fund', color: '#10b981' },
  { value: 'revenue', label: 'Revenue / Credit', color: '#16a34a' },
  { value: 'other', label: 'Other', color: '#374151' }
];

export const PAYMENT_MODES = [
  'Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Others'
] as const;

export const SUBJECT_OPTIONS = [
  'Quran Recitation', 'Diniyat', 'Urdu', 'Islamic Jurisprudence', 
  'Naat Khawni', 'Surahs Learning', 'Hifz', 
  'Fiqh & Aqeedah', 'Gez-z / Gen-x Competitions'
] as const;
