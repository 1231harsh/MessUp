import axios from 'axios';

// Configure axios with base URL
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookies
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const refreshResponse = await api.post("/api/auth/refresh"); // Refresh token cookie is sent automatically
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest); // Retry the original request
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        console.error("❌ Refresh failed, redirect to login");
        // Optionally: redirect to login page here
        return Promise.reject(refreshError);
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
    console.log('🔄 Attempting registration with data:', userData);

    const response = await api.post('/api/auth/register', {
      username: userData.fullName,
      email: userData.email,
      password: userData.password
    });

    console.log('✅ Registration successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Registration failed:', error.response?.data || error.message);

    // Handle specific error cases
    if (error.response?.status === 409) {
      throw new Error('User already exists with this email');
    } else if (error.response?.status === 400) {
      throw new Error(error.response?.data?.message || 'Invalid registration data');
    } else if (error.code === 'ERR_NETWORK') {
      throw new Error('Network error - please check if the server is running');
    }

    throw new Error(error.response?.data?.message || 'Registration failed');
  }
};

export const logout = async () => {
  try {
    const response = await api.post('/api/auth/logout');
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Logout failed');
  }
};

// Get current logged-in user
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/api/users/current');
    return response.data;
  } catch (error) {
    // Check if it's an OAuth2 redirect
    if (error.message.includes('oauth2') || error.message.includes('Authentication required')) {
      throw new Error('Authentication required - please login again');
    }
    throw new Error(error.response?.data?.message || 'Failed to get current user');
  }
};

// Check OAuth2 authentication status
// export const checkOAuth2Status = async () => {
//   try {
//     const response = await api.get('/api/auth/oauth2/status');
//     return response.data;
//   } catch (error) {
//     throw new Error(error.response?.data?.message || 'Failed to check OAuth2 status');
//   }
// };

// User search
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

// Get user by ID
export const getUserById = async (userId) => {
  try {
    console.log('Attempting to fetch user with ID:', userId);

    let response;
    try {
      response = await api.get(`/api/users/${userId}`);
    } catch (error) {
      console.log('First endpoint failed, trying alternative...');
      try {
        response = await api.get(`/api/user/${userId}`);
      } catch (error2) {
        console.log('Second endpoint failed, trying search...');
        response = await api.get('/api/users/search', {
          params: { id: userId }
        });
      }
    }

    console.log('User fetch successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('All user fetch attempts failed for ID:', userId, error);

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

    const messages = Array.isArray(response.data) ? response.data : [];

    return messages.map((msg, index) => ({
      _id: `old-${username}-${index}-${Date.now()}`,
      senderId: msg.sender,
      receiverId: msg.receiver,
      text: msg.message,
      image: msg.mediaUrl || null,
      mediaType: msg.mediaType,
      createdAt: msg.timestamp,
      isOld: true
    }));
  } catch (error) {
    console.error('Failed to fetch old chat messages:', error.response?.data || error.message);
    return [];
  }
};

// Get all friends for the current user
export const getAllFriends = async () => {
  try {
    console.log('Fetching friends list from backend...');
    const response = await api.get('/friends/getAllFriends');
    console.log('Friends response:', response.data);

    let friends = response.data;

    if (friends && typeof friends === 'object' && friends.friends) {
      friends = friends.friends;
    }

    if (friends && typeof friends === 'object' && friends.data) {
      friends = friends.data;
    }

    if (!Array.isArray(friends)) {
      console.warn('Friends response is not an array:', friends);
      return [];
    }

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
    return [];
  }
};

// Create separate axios instances for different services
const createFriendsApi = () => {
  const friendsApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 10000,
  });

  friendsApi.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('Friends API Error:', error);

      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        throw new Error(`Unable to connect to server. Please ensure the backend is running on ${API_BASE_URL}`);
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please try again.');
      }

      return Promise.reject(error);
    }
  );

  return friendsApi;
};

const createNotificationsApi = () => {
  const notificationsApi = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 10000,
  });

  notificationsApi.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('Notifications API Error:', error);

      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        throw new Error(`Unable to connect to server. Please ensure the backend is running on ${API_BASE_URL}`);
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

    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Unable to connect to server. Please check if the backend is running and CORS is properly configured.');
    }

    const errorMessage = error.response?.data || error.message;

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

    throw new Error(errorMessage || 'Failed to send friend request');
  }
};

export const acceptFriendRequest = async (requestId) => {
  try {
    console.log('Accepting friend request with ID:', requestId);

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

    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Unable to connect to server. Please check if the backend is running.');
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please try again.');
    }

    const errorMessage = error.response?.data?.message || error.response?.data || error.message;
    throw new Error(errorMessage || 'Failed to accept friend request');
  }
};

export const rejectFriendRequest = async (requestId) => {
  try {
    console.log('Rejecting friend request with ID:', requestId);

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

    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      throw new Error('Unable to connect to server. Please check if the backend is running.');
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please try again.');
    }

    const errorMessage = error.response?.data?.message || error.response?.data || error.message;
    throw new Error(errorMessage || 'Failed to reject friend request');
  }
};

// Notifications
export const getUnreadNotifications = async () => {
  try {
    console.log('Fetching notifications from backend...');
    const notificationsApi = createNotificationsApi();
    const response = await notificationsApi.get('/notifications/unread');
    console.log('Notifications response:', response.data);

    let notifications = response.data;

    if (notifications && typeof notifications === 'object' && notifications.notifications) {
      notifications = notifications.notifications;
    }

    if (notifications && typeof notifications === 'object' && notifications.data) {
      notifications = notifications.data;
    }

    if (!Array.isArray(notifications)) {
      console.warn('Notifications response is not an array:', notifications);
      return [];
    }

    return notifications;
  } catch (error) {
    console.error('Failed to fetch notifications:', error.response?.data || error.message);
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
``
export default api;
