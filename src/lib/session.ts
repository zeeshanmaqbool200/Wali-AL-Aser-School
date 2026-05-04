/**
 * Simple session management using cookies/localStorage
 */

export const saveSessionUser = (user: any) => {
  if (!user) return;
  try {
    const sessionData = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      photoURL: user.photoURL,
      isVerified: user.isVerified
    };
    localStorage.setItem('wali_session_v1', JSON.stringify(sessionData));
    
    // Also set a cookie for server-side if needed (short term 7 days)
    const d = new Date();
    d.setTime(d.getTime() + (7 * 24 * 60 * 60 * 1000));
    document.cookie = `wali_user_id=${user.uid}; expires=${d.toUTCString()}; path=/; SameSite=Strict`;
  } catch (e) {
    console.error('Failed to save session:', e);
  }
};

export const getSessionUser = () => {
  try {
    const saved = localStorage.getItem('wali_session_v1');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem('wali_session_v1');
  document.cookie = "wali_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};
