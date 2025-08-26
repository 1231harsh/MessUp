import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, UserPlus, RefreshCw } from 'lucide-react';
import { getUnreadNotifications, markNotificationAsRead, acceptFriendRequest, rejectFriendRequest, getUserById } from '../lib/api';
import toast from 'react-hot-toast';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userCache, setUserCache] = useState({});
  const [processingRequests, setProcessingRequests] = useState(new Set());
  const [notificationCount, setNotificationCount] = useState(0);
  const [shownNotifications, setShownNotifications] = useState(new Set());
  const dropdownRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastFetchedNotifications = useRef(new Set()); // Track last fetched notification IDs
  const hasInitialLoad = useRef(false); // Track if initial load is complete

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Start real-time polling when component mounts
  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Start polling every 5 seconds for real-time updates
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 5000);

    const handleFriendRequestSent = () => {
      setTimeout(() => {
        fetchNotifications();
      }, 1000);
    };

    window.addEventListener('friendRequestSent', handleFriendRequestSent);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      window.removeEventListener('friendRequestSent', handleFriendRequestSent);
    };
  }, []);

  // Update notification count when notifications change
  useEffect(() => {
    setNotificationCount(notifications.length);
  }, [notifications]);

  const fetchUserDetails = async (userId) => {
    if (userCache[userId]) {
      return userCache[userId];
    }

    try {
      console.log('Fetching user details for ID:', userId);
      const userDetails = await getUserById(userId);
      console.log('User details fetched:', userDetails);

      setUserCache(prev => ({
        ...prev,
        [userId]: userDetails
      }));
      return userDetails;
    } catch (error) {
      console.error('Failed to fetch user details for ID:', userId, error);

      // Return fallback user data
      const fallbackUser = {
        id: userId,
        username: `User${userId}`,
        email: '',
        profilePic: null
      };

      setUserCache(prev => ({
        ...prev,
        [userId]: fallbackUser
      }));

      return fallbackUser;
    }
  };

  const fetchNotifications = async () => {
    // Only show loading spinner if dropdown is open and no notifications exist
    if (isOpen && notifications.length === 0) {
      setIsLoading(true);
    }

    try {
      const data = await getUnreadNotifications();
      const notificationsArray = Array.isArray(data) ? data : [];

      console.log('Raw notifications from backend:', notificationsArray);

      // Simple approach: reference_id = sender's user ID
      const notificationsWithSenderDetails = await Promise.all(
        notificationsArray.map(async (notification) => {
          if (notification.type === 'FRIEND_REQUEST' || notification.type === 'friend_request') {
            // reference_id IS the sender's user ID - simple!

            const senderUserId = notification.referenceId;

            console.log('Getting user details for sender ID:', senderUserId);

            // Fetch sender details using reference_id as user ID
            const senderDetails = await fetchUserDetails(senderUserId);

            return {
              ...notification,
              senderDetails: senderDetails,
              friendRequestId: notification.id, // Use notification ID for actions
            };
          }

          return notification;
        })
      );

      console.log('Processed notifications:', notificationsWithSenderDetails);

      // Get current notification IDs
      const currentNotificationIds = new Set(notificationsWithSenderDetails.map(n => n.id));

      // Only show toasts after initial load to avoid showing toasts for existing notifications
      if (hasInitialLoad.current) {
        // Find truly new notifications (not in previous fetch AND not already shown)
        const newNotifications = notificationsWithSenderDetails.filter(
          n => !lastFetchedNotifications.current.has(n.id) && !shownNotifications.has(n.id)
        );

        // Show toast for new friend requests
        newNotifications.forEach(notification => {
          if (notification.type === 'FRIEND_REQUEST' || notification.type === 'friend_request') {
            const senderName = notification.senderDetails?.username || 'Someone';
            toast.success(`New friend request from ${senderName}!`, {
              duration: 4000,
              icon: '👋',
            });

            console.log(`Toast shown for notification ${notification.id} from ${senderName}`);
          }
        });

        // Mark all new notifications as shown
        if (newNotifications.length > 0) {
          setShownNotifications(prev => {
            const newSet = new Set(prev);
            newNotifications.forEach(n => newSet.add(n.id));
            return newSet;
          });
        }
      } else {
        // Mark initial load as complete
        hasInitialLoad.current = true;

        // Mark all initial notifications as shown to prevent toasts on first load
        if (notificationsWithSenderDetails.length > 0) {
          setShownNotifications(prev => {
            const newSet = new Set(prev);
            notificationsWithSenderDetails.forEach(n => newSet.add(n.id));
            return newSet;
          });
        }
      }

      // Update the last fetched notifications reference
      lastFetchedNotifications.current = currentNotificationIds;

      setNotifications(notificationsWithSenderDetails);
    } catch (error) {
      console.error('Failed to fetch notifications:', error.response?.data || error.message);
      // Only show error toast if dropdown is open to avoid spam
      if (isOpen && notifications.length === 0) {
        toast.error('Failed to fetch notifications');
      }
      setNotifications([]);
    } finally {
      if (isOpen) {
        setIsLoading(false);
      }
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      // Remove from shown notifications when marked as read
      setShownNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });

      // Remove from last fetched notifications
      lastFetchedNotifications.current.delete(notificationId);

      toast.success('Notification marked as read');
    } catch (error) {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleAcceptFriendRequest = async (requestId, notificationId) => {
    if (!requestId || requestId === 'undefined' || requestId === undefined) {
      toast.error('Invalid request ID. Please refresh and try again.');
      return;
    }

    if (processingRequests.has(requestId)) {
      return;
    }

    setProcessingRequests(prev => new Set(prev).add(requestId));

    try {
      await acceptFriendRequest(requestId);
      await handleMarkAsRead(notificationId);
      toast.success('Friend request accepted!');

      // Remove the notification immediately from state and shown notifications
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setShownNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });

      // Remove from last fetched notifications
      lastFetchedNotifications.current.delete(notificationId);

      // Trigger event to refresh friends list in sidebar
      window.dispatchEvent(new CustomEvent('friendRequestAccepted'));
    } catch (error) {
      if (error.message.includes('connect to server')) {
        toast.error('Unable to connect to server. Please check your connection and try again.');
      } else if (error.message.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else if (error.message.includes('Invalid request ID')) {
        toast.error('Invalid request. Please refresh the page and try again.');
      } else {
        toast.error(error.message || 'Failed to accept friend request');
      }
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleRejectFriendRequest = async (requestId, notificationId) => {
    if (!requestId || requestId === 'undefined' || requestId === undefined) {
      toast.error('Invalid request ID. Please refresh and try again.');
      return;
    }

    if (processingRequests.has(requestId)) {
      return;
    }

    setProcessingRequests(prev => new Set(prev).add(requestId));

    try {
      await rejectFriendRequest(requestId);
      await handleMarkAsRead(notificationId);
      toast.success('Friend request rejected');

      // Remove the notification immediately from state and shown notifications
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setShownNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });

      // Remove from last fetched notifications
      lastFetchedNotifications.current.delete(notificationId);
    } catch (error) {
      if (error.message.includes('connect to server')) {
        toast.error('Unable to connect to server. Please check your connection and try again.');
      } else if (error.message.includes('timeout')) {
        toast.error('Request timed out. Please try again.');
      } else if (error.message.includes('Invalid request ID')) {
        toast.error('Invalid request. Please refresh the page and try again.');
      } else {
        toast.error(error.message || 'Failed to reject friend request');
      }
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const formatTimeAgo = (timestamp) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days > 0) return `${days}d`;
      if (hours > 0) return `${hours}h`;
      if (minutes > 0) return `${minutes}m`;
      return 'now';
    } catch (error) {
      return 'now';
    }
  };

  const handleToggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleRefresh = () => {
    fetchNotifications();
    toast.success('Notifications refreshed');
  };

  const getUserAvatar = (notification) => {
    return notification.senderDetails?.profilePic || null;
  };

  const getUserInitial = (notification) => {
    if (notification.senderDetails?.username) {
      return notification.senderDetails.username.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggleDropdown}
        className={`relative p-2 rounded-full hover:bg-base-200 transition-colors ${
          notificationCount > 0 ? 'animate-pulse' : ''
        }`}
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-bounce">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-base-100 border border-base-300 rounded-xl shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between bg-base-50">
            <h3 className="font-semibold text-base-content">
              Notifications {notificationCount > 0 && (
                <span className="ml-2 text-xs bg-primary text-primary-content px-2 py-1 rounded-full">
                  {notificationCount}
                </span>
              )}
            </h3>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-base-content/60">
                <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-sm">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-base-content/60">
                <Bell className="size-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No new notifications</p>
                <p className="text-xs mt-1 opacity-75">Friend requests will appear here</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => {
                  const requestId = notification.friendRequestId || notification.id;
                  const isProcessing = processingRequests.has(requestId);

                  return (
                    <div key={notification.id} className="px-4 py-3 hover:bg-base-50 transition-colors border-b border-base-200 last:border-b-0 animate-fadeIn">
                      <div className="flex items-start gap-3">
                        {/* User Avatar */}
                        <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-base-200">
                          {getUserAvatar(notification) ? (
                            <img
                              src={getUserAvatar(notification)}
                              alt={notification.senderDetails?.username || 'User'}
                              className="size-10 rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ${
                              getUserAvatar(notification) ? 'hidden' : 'flex'
                            }`}
                          >
                            <span className="text-primary font-semibold text-sm">
                              {getUserInitial(notification)}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-base-content leading-tight">
                                <span className="font-semibold text-primary">
                                  {notification.senderDetails?.username || 'Someone'}
                                </span>
                                <span className="text-base-content/80 ml-1">
                                  sent you a friend request
                                </span>
                              </p>
                              <p className="text-xs text-base-content/50 mt-0.5 flex items-center gap-1">
                                <span>{formatTimeAgo(notification.createdAt || notification.timestamp)}</span>
                                <span className="size-1 bg-base-content/30 rounded-full"></span>
                                <span>Friend Request</span>
                              </p>
                            </div>

                            {/* Action Icons - Right Side */}
                            {(notification.type === 'FRIEND_REQUEST' || notification.type === 'friend_request') && (
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() => handleAcceptFriendRequest(requestId, notification.id)}
                                  disabled={isProcessing || !requestId}
                                  className="size-7 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                  title="Accept friend request"
                                >
                                  {isProcessing ? (
                                    <div className="size-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Check className="size-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleRejectFriendRequest(requestId, notification.id)}
                                  disabled={isProcessing || !requestId}
                                  className="size-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                  title="Reject friend request"
                                >
                                  {isProcessing ? (
                                    <div className="size-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <X className="size-3.5" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* General notification mark as read */}
                          {notification.type !== 'FRIEND_REQUEST' && notification.type !== 'friend_request' && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-xs text-primary hover:text-primary/80 mt-2 transition-colors"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
