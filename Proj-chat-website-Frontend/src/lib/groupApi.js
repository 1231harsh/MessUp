import axios from 'axios';

// Configure axios for group API calls
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const groupApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // This is the key for cookie-based auth
});

// Add response interceptor to handle errors
groupApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Group API Error:', error.response?.data || error.message);

    // Handle OAuth redirect issue
    if (error.response?.status === 302 ||
        (error.response?.data && typeof error.response.data === 'string' &&
         error.response.data.includes('oauth2'))) {
      console.error('❌ Backend is redirecting to OAuth - check authentication');
      throw new Error('Authentication required - please login again');
    }

    // Handle HTML responses (OAuth2 redirects)
    if (error.response?.data && typeof error.response.data === 'string' &&
        (error.response.data.includes('<!DOCTYPE html>') || error.response.data.includes('<html>'))) {
      console.error('❌ Received HTML response instead of JSON - likely OAuth2 redirect');
      throw new Error('Authentication required - please login again');
    }

    return Promise.reject(error);
  }
);

// Create a new group - UPDATED TO USE /groupChat/create
export const createGroup = async (groupData) => {
  try {
    console.log('📤 Creating group with data:', groupData);

    // Match your backend DTO structure
    const response = await groupApi.post('/groupChat/create', {
      groupName: groupData.name,
      createdBy: groupData.createdBy,
      memberUsernames: groupData.members
    });

    console.log('✅ Group created:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create group:', error);
    throw new Error(error.response?.data || 'Failed to create group');
  }
};

// Get user's groups - UPDATED TO USE /groupChat/getGroups
export const getUserGroups = async () => {
  try {
    console.log('📤 Fetching user groups...');

    const response = await groupApi.get('/groupChat/getGroups');
    console.log('✅ User groups fetched:', response.data);

    // Handle different response formats from backend
    let groups = response.data;

    // If response.data is an object with a groups array
    if (groups && typeof groups === 'object' && groups.groups) {
      groups = groups.groups;
    }

    // If response.data is an object with a data array
    if (groups && typeof groups === 'object' && groups.data) {
      groups = groups.data;
    }

    // Ensure we return an array
    if (!Array.isArray(groups)) {
      console.warn('Groups response is not an array:', groups);
      return [];
    }

    // Transform backend group data to match frontend format
    return groups.map(group => ({
      id: group.id?.toString() || group._id,
      name: group.groupName || group.name || 'Unnamed Group',
      createdBy: group.createdBy || 'Unknown',
      members: group.members || [],
      createdAt: group.createdAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('❌ Failed to fetch user groups:', error);
    return []; // Return empty array if API fails
  }
};

// Get group messages - UPDATED TO USE /groupChat/{groupId}
export const getGroupMessages = async (groupId) => {
  try {
    console.log('📤 Fetching messages for group:', groupId);

    const response = await groupApi.get(`/groupChat/${groupId}`);
    console.log('✅ Group messages fetched:', response.data);

    // Handle different response formats from backend
    let messages = response.data;

    // If response.data is an object with a messages array
    if (messages && typeof messages === 'object' && messages.messages) {
      messages = messages.messages;
    }

    // If response.data is an object with a data array
    if (messages && typeof messages === 'object' && messages.data) {
      messages = messages.data;
    }

    // Ensure we return an array
    if (!Array.isArray(messages)) {
      console.warn('Messages response is not an array:', messages);
      return [];
    }

    return messages;
  } catch (error) {
    console.error('❌ Failed to fetch group messages:', error);
    return []; // Return empty array if API fails
  }
};

// Get group members - UPDATED TO USE /groupChat/getGroupMembers/{groupId}
export const getGroupMembers = async (groupId) => {
  try {
    console.log('📤 Fetching members for group:', groupId);

    const response = await groupApi.get(`/groupChat/getGroupMembers/${groupId}`);
    console.log('✅ Group members fetched:', response.data);

    // Handle different response formats from backend
    let members = response.data;

    // If response.data is an object with a members array
    if (members && typeof members === 'object' && members.members) {
      members = members.members;
    }

    // If response.data is an object with a data array
    if (members && typeof members === 'object' && members.data) {
      members = members.data;
    }

    // Ensure we return an array
    if (!Array.isArray(members)) {
      console.warn('Members response is not an array:', members);
      return [];
    }

    // Transform backend member data to match frontend format
    return members.map(member => ({
      id: member.id?.toString() || member._id,
      username: member.username || member.name || 'Unknown User',
      fullName: member.fullName || member.username || 'Unknown User',
      profilePic: member.profilePic || member.profilePicture || '/avatar.png',
      isOnline: member.isOnline || member.onlineStatus || false,
      email: member.email || ''
    }));
  } catch (error) {
    console.error('❌ Failed to fetch group members:', error);
    return []; // Return empty array if API fails
  }
};

export default groupApi;
