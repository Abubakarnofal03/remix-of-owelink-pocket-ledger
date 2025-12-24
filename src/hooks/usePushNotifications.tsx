import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
      // Request permission
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive === 'granted') {
        // Register with FCM
        await PushNotifications.register();
      } else {
        console.log('Push notification permission denied');
      }

      // Listen for registration
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token:', token.value);
        registerToken(token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push registration error:', error);
      });

      // Listen for push notifications received while app is in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        toast(notification.title || 'Notification', {
          description: notification.body,
        });
      });

      // Listen for push notification actions (taps)
      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Push notification action:', action);
        const data = action.notification.data;
        
        // Navigate based on notification type
        if (data?.type === 'bill' && data?.id) {
          window.location.href = `/bills/${data.id}`;
        } else if (data?.type === 'iou' && data?.id) {
          window.location.href = `/ious/${data.id}`;
        }
      });

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
