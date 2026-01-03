import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { saveNotification } from '@/lib/localNotifications';

// Global pending navigation for when notification is tapped before router is ready
let pendingNotificationNavigation: string | null = null;

export function getPendingNotificationNavigation(): string | null {
  const path = pendingNotificationNavigation;
  pendingNotificationNavigation = null;
  return path;
}

export function usePushNotifications() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  
  // Keep navigate ref updated
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const registerToken = useCallback(async (token: string) => {
    if (!user || !profile?.phone_suffix) {
      console.log('Cannot register token: no user or phone_suffix');
      return;
    }

    try {
      const { error } = await supabase
        .from('device_tokens')
        .upsert({
          user_id: user.id,
          phone_suffix: profile.phone_suffix,
          fcm_token: token,
          device_platform: Capacitor.getPlatform(),
        }, {
          onConflict: 'user_id,fcm_token'
        });

      if (error) {
        console.error('Error registering device token:', error);
      } else {
        console.log('Device token registered successfully');
      }
    } catch (err) {
      console.error('Failed to register token:', err);
    }
  }, [user, profile]);

  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only available on native platforms');
      return;
    }

    try {
      // Set up listeners BEFORE requesting permission to catch all events
      await PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token:', token.value);
        try {
          registerToken(token.value);
        } catch (err) {
          console.error('Error in registerToken:', err);
        }
      });

      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push registration error:', error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        try {
          // Save notification to local storage
          saveNotification({
            title: notification.title || 'Notification',
            body: notification.body || '',
            data: notification.data,
          });

          // Dispatch event to update UI
          window.dispatchEvent(new Event('notification-update'));

          // Show toast with action to navigate
          const data = notification.data;
          if (data?.type === 'bill' && data?.id) {
            toast(notification.title || 'Notification', {
              description: notification.body,
              action: {
                label: 'View',
                onClick: () => navigateRef.current(`/bills/${data.id}`),
              },
            });
          } else if (data?.type === 'iou' && data?.id) {
            toast(notification.title || 'Notification', {
              description: notification.body,
              action: {
                label: 'View',
                onClick: () => navigateRef.current(`/ious/${data.id}`),
              },
            });
          } else {
            toast(notification.title || 'Notification', {
              description: notification.body,
            });
          }
        } catch (err) {
          console.error('Error handling notification:', err);
        }
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Push notification action performed:', action);
        try {
          // Save when user taps on notification
          const notification = action.notification;
          saveNotification({
            title: notification.title || 'Notification',
            body: notification.body || '',
            data: notification.data,
          });

          window.dispatchEvent(new Event('notification-update'));

          const data = notification.data;
          let targetPath: string | null = null;
          
          if (data?.type === 'bill' && data?.id) {
            targetPath = `/bills/${data.id}`;
          } else if (data?.type === 'iou' && data?.id) {
            targetPath = `/ious/${data.id}`;
          }
          
          if (targetPath) {
            console.log('Navigating to:', targetPath);
            // Use React Router navigation instead of window.location
            // This works properly within the WebView and maintains app state
            try {
              navigateRef.current(targetPath);
            } catch (navErr) {
              // If navigation fails (e.g., app not fully initialized), store for later
              console.log('Navigation failed, storing for later:', navErr);
              pendingNotificationNavigation = targetPath;
            }
          }
        } catch (err) {
          console.error('Error handling notification action:', err);
        }
      });

      // Check current permission status (don't request here, it's handled by useAppPermissions)
      const permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'granted') {
        // Register with FCM
        await PushNotifications.register();
      } else {
        console.log('Push notification permission not granted yet');
      }
    } catch (err) {
      console.error('Error initializing push notifications:', err);
    }
  }, [registerToken]);

  // Check for pending navigation on mount/user change
  useEffect(() => {
    if (user) {
      const pendingPath = getPendingNotificationNavigation();
      if (pendingPath) {
        console.log('Processing pending notification navigation:', pendingPath);
        // Small delay to ensure app is ready
        setTimeout(() => navigate(pendingPath), 100);
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && profile?.phone_suffix) {
      initializePushNotifications();
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user, profile, initializePushNotifications]);

  return { initializePushNotifications };
}
