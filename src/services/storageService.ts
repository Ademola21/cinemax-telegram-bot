/**
 * Storage Service - Session Management
 * Handles user session storage and retrieval
 */

export interface UserSession {
  userId?: string;
  token: string;
  csrfToken?: string;
  email?: string;
  name?: string;
  role?: 'admin' | 'user';
}

/**
 * Get current user session from localStorage
 */
export const getSession = (): UserSession | null => {
  try {
    if (typeof window === 'undefined') return null;
    
    const sessionData = localStorage.getItem('userSession');
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    
    // Validate session structure
    if (!session.token) {
      console.warn('Invalid session structure found');
      localStorage.removeItem('userSession');
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    localStorage.removeItem('userSession');
    return null;
  }
};

/**
 * Save user session to localStorage
 */
export const saveSession = (session: UserSession): void => {
  try {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('userSession', JSON.stringify(session));
  } catch (error) {
    console.error('Error saving session:', error);
  }
};

/**
 * Clear user session from localStorage
 */
export const clearSession = (): void => {
  try {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('userSession');
  } catch (error) {
    console.error('Error clearing session:', error);
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const session = getSession();
  return !!session?.token;
};

/**
 * Check if user is admin
 */
export const isAdmin = (): boolean => {
  const session = getSession();
  return session?.role === 'admin';
};

/**
 * Get current user ID
 */
export const getCurrentUserId = (): string | null => {
  const session = getSession();
  return session?.userId || null;
};