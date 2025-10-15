/**
 * Storage Service - Session Management & API Integration
 * Handles user authentication, session storage, and data persistence
 */

import { User } from './types';

export interface UserSession {
  userId?: string;
  token: string;
  csrfToken?: string;
  email?: string;
  name?: string;
  role?: 'admin' | 'user';
  user?: User;
}

export interface UserData {
  watchlist: string[];
  history: { movieId: string; viewedAt: string }[];
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
 * Create a new session after login/signup
 */
export const createSession = (sessionData: { user: User; token: string; csrfToken?: string }): void => {
  try {
    if (typeof window === 'undefined') return;
    
    const session: UserSession = {
      userId: sessionData.user.id,
      token: sessionData.token,
      csrfToken: sessionData.csrfToken,
      email: sessionData.user.email,
      name: sessionData.user.name,
      role: sessionData.user.role,
      user: sessionData.user
    };
    
    localStorage.setItem('userSession', JSON.stringify(session));
  } catch (error) {
    console.error('Error creating session:', error);
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

/**
 * Login user with email and password
 */
export const login = async (email: string, password: string): Promise<User | null> => {
  try {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await response.json();
    
    // Create session with returned data
    createSession({
      user: data.user,
      token: data.token,
      csrfToken: data.csrfToken
    });

    return data.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Signup new user
 */
export const signup = async (name: string, email: string, password: string, username: string): Promise<User | null> => {
  try {
    const response = await fetch('/api/users/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password, username }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Signup failed');
    }

    const data = await response.json();
    
    // Create session with returned data
    createSession({
      user: data.user,
      token: data.token,
      csrfToken: data.csrfToken
    });

    return data.user;
  } catch (error) {
    console.error('Signup error:', error);
    throw error;
  }
};

/**
 * Get user data (watchlist and history)
 */
export const getUserData = async (): Promise<UserData> => {
  try {
    const session = getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch('/api/users/data', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'X-CSRF-Token': session.csrfToken || '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get user data');
    }

    return await response.json();
  } catch (error) {
    console.error('Get user data error:', error);
    throw error;
  }
};

/**
 * Toggle movie in watchlist
 */
export const toggleWatchlist = async (movieId: string): Promise<void> => {
  try {
    const session = getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch('/api/users/watchlist', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'X-CSRF-Token': session.csrfToken || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ movieId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update watchlist');
    }

    // Response contains updated watchlist, but we don't need to use it
    // as the UI will optimistic update and re-fetch if needed
  } catch (error) {
    console.error('Toggle watchlist error:', error);
    throw error;
  }
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    const session = getSession();
    if (!session) return;

    // Call logout endpoint to revoke server session
    await fetch('/api/users/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'X-CSRF-Token': session.csrfToken || '',
        'Content-Type': 'application/json',
      },
    });

    // Clear local session regardless of API call success
    clearSession();
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear local session even if API call fails
    clearSession();
  }
};

/**
 * Add movie to viewing history
 */
export const addToHistory = async (movieId: string): Promise<void> => {
  try {
    const session = getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch('/api/users/history', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'X-CSRF-Token': session.csrfToken || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ movieId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update history');
    }
  } catch (error) {
    console.error('Add to history error:', error);
    // Don't throw error for history updates as it's not critical
  }
};

/**
 * Add movie to viewing history (alias for addToHistory)
 */
export const addToViewingHistory = addToHistory;

/**
 * Update user profile
 */
export const updateUserProfile = async (profileData: { name?: string; username?: string; profilePic?: string }): Promise<User> => {
  try {
    const session = getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'X-CSRF-Token': session.csrfToken || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update profile');
    }

    const data = await response.json();
    
    // Update session with new user data
    createSession({
      user: data.user,
      token: data.token,
      csrfToken: data.csrfToken
    });

    return data.user;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};

/**
 * Reset user password
 */
export const resetPassword = async (passwordData: { currentPassword: string; newPassword: string }): Promise<void> => {
  try {
    const session = getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch('/api/users/reset-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'X-CSRF-Token': session.csrfToken || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passwordData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to reset password');
    }
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
};