import axios from 'axios';
import { isTokenExpired } from './jwtUtils';

// Configure axios with base URL - REMOVED /api prefix
const API_BASE_URL = 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS with credentials
});

// Add request interceptor to include auth token and check expiration
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      // Check if token is expired before making request
      if (isTokenExpired(token)) {
        console.warn('Token expired, removing from storage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }

        return Promise.reject(new Error('Token expired'));
      }

      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.warn('Unauthorized request, clearing all auth data');

      // Clear all possible auth-related localStorage items
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('authUser');

      // Clear any other auth-related items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('auth') || key.includes('token') || key.includes('user')) {
          localStorage.removeItem(key);
        }
      });

      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const login = async (credentials) => {
  try {
    const response = await api.post('/api/auth/login', {
      email: credentials.email,
      password: credentials.password
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Login failed');
  }
};

export const register = async (userData) => {
  try {
    const response = await api.post('/api/auth/register', {
      username: userData.fullName,
      email: userData.email,
      password: userData.password
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Registration failed');
  }
};

// User search - NOW WITH /api PREFIX
export const searchUser = async (searchTerm) => {
  try {
    const params = {};
    if (searchTerm.includes('@')) {
      params.email = searchTerm;
    } else {
      params.username = searchTerm;
    }

    const response = await api.get('/api/users/search', { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'User search failed');
  }
};

// Get user by ID - Updated to handle different possible endpoints WITH /api PREFIX
export const getUserById = async (userId) => {
  try {
    console.log('Attempting to fetch user with ID:', userId);

    // Try different possible endpoints with /api prefix
    let response;
    try {
      // First try: /api/users/{id}
      response = await api.get(`/api/users/${userId}`);
    } catch (error) {
      console.log('First endpoint failed, trying alternative...');
      try {
        // Second try: /api/user/{id}
        response = await api.get(`/api/user/${userId}`);
      } catch (error2) {
        console.log('Second endpoint failed, trying search...');
        // Third try: use search endpoint with ID
        response = await api.get('/api/users/search', {
          params: { id: userId }
        });
      }
    }

    console.log('User fetch successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('All user fetch attempts failed for ID:', userId, error);

    // Return a fallback user object instead of throwing
    return {
      id: userId,
      username: `User${userId}`,
      email: '',
      profilePic: null
    };
  }
};

// Get old chat messages for a specific user
export const getOldChatMessages = async (username) => {
  try {
    console.log('Fetching old chat messages for user:', username);
    const response = await api.get(`/oldChat/${username}`);
    console.log('Old chat messages response:', response.data);

    // Transform backend message format to frontend format
    const messages = Array.isArray(response.data) ? response.data : [];

    return messages.map((msg, index) => ({
      _id: `old-${username}-${index}-${Date.now()}`,
      senderId: msg.sender,
      receiverId: msg.receiver,
      text: msg.message,
      image: msg.mediaUrl || null,
      mediaType: msg.mediaType,
      createdAt: msg.timestamp,
      isOld: true // Flag to identify old messages
    }));
  } catch (error) {
    console.error('Failed to fetch old chat messages:', error.response?.data || error.message);

    // Return empty array if API fails
    return [];
  }
};

// Get all friends for the current user - NO /api prefix (as per your instruction)
export const getAllFriends = async () => {
  try {
    console.log('Fetching friends list from backend...');
    const response = await api.get('/friends/getAllFriends');
    console.log('Friends response:', response.data);

    // Handle different response formats from backend
    let friends = response.data;

    // If response.data is an object with a friends array
    if (friends && typeof friends === 'object' && friends.friends) {
      friends = friends.friends;
    }

    // If response.data is an object with a data array
    if (friends && typeof friends === 'object' && friends.data) {
      friends = friends.data;
    }

    // Ensure we return an array
    if (!Array.isArray(friends)) {
      console.warn('Friends response is not an array:', friends);
      return [];
    }

    // Transform backend user data to match frontend format
    return friends.map(friend => ({
      _id: friend.id?.toString() || friend._id,
      fullName: friend.username || friend.fullName || 'Unknown User',
      profilePic: friend.profilePicture || friend.profilePic || '/avatar.png',
      isOnline: friend.onlineStatus || friend.isOnline || false,
      email: friend.email || '',
      username: friend.username || friend.fullName || 'Unknown'
    }));
  } catch (error) {
    console.error('Failed to fetch friends:', error.response?.data || error.message);

    // Return empty array if API fails
    return [];
  }
};

// Create a separate axios instance for friend requests with proper error handling
const createFriendsApi = () => {
  const friendsApi = axios.create({
    baseURL: 'http://localhost:8080', // No /api prefix
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 10000, // 10 second timeout
  });

  // Add auth interceptor for friends API
  friendsApi.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response interceptor for better error handling
  friendsApi.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('Friends API Error:', error);

      // Handle different types of errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        throw new Error('Unable to connect to server. Please ensure the backend is running on http://localhost:8080');
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please try again.');
      }

      return Promise.reject(error);
    }
  );

  return friendsApi;
};

// Create a separate axios instance for notifications with /api prefix
const createNotificationsApi = () => {
  const notificationsApi = axios.create({
    baseURL: 'http://localhost:8080/api', // WITH /api prefix for notifications
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 10000, // 10 second timeout
  });

  // Add auth interceptor for notifications API
  notificationsApi.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response interceptor for better error handling
  notificationsApi.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('Notifications API Error:', error);

      // Handle different types of errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        throw new Error('Unable to connect to server. Please ensure the backend is running on http://localhost:8080');
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please try again.');
      }

      return Promise.reject(error);
    }
  );

  return notificationsApi;
};

export const sendFriendRequest = async (senderUsername, receiverUsername) => {
  try {
    console.log('Sending friend request:', { senderUsername, receiverUsername });

    const friendsApi = createFriendsApi();
    const response = await friendsApi.post('/friends/request', null, {
      params: {
        senderUsername: senderUsername,
        receiverUsername: receiverUsername
      }
    });

    console.log('Friend request response:', response.data);

    // Check if the response indicates users are already friends
    const responseMessage = response.data;
    if (typeof responseMessage === 'string') {
      const lowerMessage = responseMessage.toLowerCase();

      if (lowerMessage.includes('already friends')) {
        throw new Error('ALREADY_FRIENDS');
      }

      if (lowerMessage.includes('already exists') ||
          lowerMessage.includes('pending') ||
          lowerMessage.includes('duplicate')) {
        throw new Error('FRIEND_REQUEST_EXISTS');
      }
    }

    return response.data;
  } catch (error) {
    console.error('Friend request error:', error.response?.data || error.message);
    console.error('Full error:', error);

    // Handle CORS and network errors
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Unable to connect to server. Please check if the backend is running and CORS is properly configured.');
    }

    // Handle specific error cases
    const errorMessage = error.response?.data || error.message;

    // Check for common "already exists" error patterns
    if (typeof errorMessage === 'string') {
      const lowerErrorMessage = errorMessage.toLowerCase();

      if (lowerErrorMessage.includes('already friends')) {
        throw new Error('ALREADY_FRIENDS');
      }

      if (lowerErrorMessage.includes('already') ||
          lowerErrorMessage.includes('exists') ||
          lowerErrorMessage.includes('pending') ||
          lowerErrorMessage.includes('duplicate')) {
        throw new Error('FRIEND_REQUEST_EXISTS');
      }

      if (lowerErrorMessage.includes('not found') ||
          lowerErrorMessage.includes('user not found')) {
        throw new Error('USER_NOT_FOUND');
      }
    }

    // Default error
    throw new Error(errorMessage || 'Failed to send friend request');
  }
};

export const acceptFriendRequest = async (requestId) => {
  try {
    console.log('Accepting friend request with ID:', requestId);

    // Validate requestId
    if (!requestId) {
      throw new Error('Invalid request ID');
    }

    const friendsApi = createFriendsApi();
    const response = await friendsApi.post('/friends/accept', null, {
      params: { requestId: requestId.toString() }
    });

    console.log('Accept friend request response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Accept friend request error:', error.response?.data || error.message);
    console.error('Full error:', error);

    // Handle CORS and network errors
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Unable to connect to server. Please check if the backend is running.');
    }

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please try again.');
    }

    // Handle specific error messages
    const errorMessage = error.response?.data?.message || error.response?.data || error.message;
    throw new Error(errorMessage || 'Failed to accept friend request');
  }
};

export const rejectFriendRequest = async (requestId) => {
  try {
    console.log('Rejecting friend request with ID:', requestId);

    // Validate requestId
    if (!requestId) {
      throw new Error('Invalid request ID');
    }

    const friendsApi = createFriendsApi();
    const response = await friendsApi.post('/friends/reject', null, {
      params: { requestId: requestId.toString() }
    });

    console.log('Reject friend request response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Reject friend request error:', error.response?.data || error.message);
    console.error('Full error:', error);

    // Handle CORS and network errors
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Unable to connect to server. Please check if the backend is running.');
    }

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please try again.');
    }

    // Handle specific error messages
    const errorMessage = error.response?.data?.message || error.response?.data || error.message;
    throw new Error(errorMessage || 'Failed to reject friend request');
  }
};

// Notifications - Using separate API instance with /api prefix
export const getUnreadNotifications = async () => {
  try {
    console.log('Fetching notifications from backend...');
    const notificationsApi = createNotificationsApi();
    const response = await notificationsApi.get('/notifications/unread');
    console.log('Notifications response:', response.data);

    // Handle different response formats from backend
    let notifications = response.data;

    // If response.data is an object with a notifications array
    if (notifications && typeof notifications === 'object' && notifications.notifications) {
      notifications = notifications.notifications;
    }

    // If response.data is an object with a data array
    if (notifications && typeof notifications === 'object' && notifications.data) {
      notifications = notifications.data;
    }

    // Ensure we return an array
    if (!Array.isArray(notifications)) {
      console.warn('Notifications response is not an array:', notifications);
      return [];
    }

    return notifications;
  } catch (error) {
    console.error('Failed to fetch notifications:', error.response?.data || error.message);

    // Return empty array if API fails - no mock data
    return [];
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationsApi = createNotificationsApi();
    const response = await notificationsApi.post(`/notifications/read/${notificationId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to mark notification as read:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Failed to mark notification as read');
  }
};

export default api;
