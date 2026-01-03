import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { saveNotification } from '@/lib/localNotifications';

export function usePushNotifications() {
  const { user, profile } = useAuth();

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

          // Show toast
          toast(notification.title || 'Notification', {
            description: notification.body,
          });
        } catch (err) {
          console.error('Error handling notification:', err);
        }
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Push notification action:', action);
        try {
          // Also save when user taps on notification
          const notification = action.notification;
          saveNotification({
            title: notification.title || 'Notification',
            body: notification.body || '',
            data: notification.data,
          });

          window.dispatchEvent(new Event('notification-update'));

          const data = notification.data;
          if (data?.type === 'bill' && data?.id) {
            window.location.href = `/bills/${data.id}`;
          } else if (data?.type === 'iou' && data?.id) {
            window.location.href = `/ious/${data.id}`;
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
