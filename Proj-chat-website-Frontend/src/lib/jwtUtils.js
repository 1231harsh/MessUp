// Cookie-based authentication utilities
// Since we're using cookies, we need to get user info from the backend

import { getCurrentUser } from './api';

// Get current user from backend (since we're using cookies)
export const getCurrentUserFromToken = async () => {
  try {
    const user = await getCurrentUser();
    return {
      username: user.username || user.name,
      email: user.email,
      name: user.fullName || user.username,
      id: user.id,
    };
  } catch (error) {
    console.error('Error getting user from backend:', error);
    return null;
  }
};


let cachedUser = null;

export const getCurrentUserFromTokenSync = () => {
  return cachedUser;
};

// Cache user data when fetched
export const setCachedUser = (user) => {
  cachedUser = user;
};

// Clear cached user data
export const clearCachedUser = () => {
  cachedUser = null;
};

// These functions are no longer needed with cookie auth, but kept for compatibility
export const decodeJWT = (token) => {
  console.warn('decodeJWT is deprecated with cookie authentication');
  return null;
};

export const isTokenExpired = (token) => {
  console.warn('isTokenExpired is deprecated with cookie authentication');
  return false;
};
