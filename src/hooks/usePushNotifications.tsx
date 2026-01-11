import { useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { saveNotification } from "@/lib/localNotifications";

// Global pending navigation for when notification is tapped before router/auth is ready
let pendingNotificationNavigation: string | null = null;

export function getPendingNotificationNavigation(): string | null {
  const path = pendingNotificationNavigation;
  pendingNotificationNavigation = null;
  return path;
}

function getTargetPathFromNotificationData(data?: Record<string, any>): string | null {
  if (data?.type === "bill" && data?.id) return `/bills/${data.id}`;
  if (data?.type === "iou" && data?.id) return `/ious/${data.id}`;
  return null;
}

export function usePushNotifications() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const navigateRef = useRef(navigate);
  const userRef = useRef(user);
  const profileRef = useRef(profile);
  const latestTokenRef = useRef<string | null>(null);
  const didInitRef = useRef(false);

  // Keep refs updated (so listeners always see latest values)
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    userRef.current = user;
    profileRef.current = profile;
  }, [user, profile]);

  const registerToken = useCallback(async (token: string) => {
    const u = userRef.current;
    const p = profileRef.current;

    if (!u || !p?.phone_suffix) {
      // user/profile might not be ready on cold start; we'll retry later
      latestTokenRef.current = token;
      return;
    }

    try {
      const { error } = await supabase
        .from("device_tokens")
        .upsert(
          {
            user_id: u.id,
            phone_suffix: p.phone_suffix,
            fcm_token: token,
            device_platform: Capacitor.getPlatform(),
          },
          {
            onConflict: "user_id,fcm_token",
          },
        );

      if (error) {
        console.error("Error registering device token:", error);
      } else {
        console.log("Device token registered successfully");
      }
    } catch (err) {
      console.error("Failed to register token:", err);
    }
  }, []);

  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log("Push notifications only available on native platforms");
      return;
    }

    // Prevent duplicate listeners
    if (didInitRef.current) return;
    didInitRef.current = true;

    try {
      // Listeners FIRST so we don't miss tap events during cold start
      await PushNotifications.addListener("registration", (token: Token) => {
        console.log("Push registration success, token:", token.value);
        latestTokenRef.current = token.value;
        registerToken(token.value);
      });

      await PushNotifications.addListener("registrationError", (error: any) => {
        console.error("Push registration error:", error);
      });

      await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification: PushNotificationSchema) => {
          console.log("Push notification received:", notification);

          // Save notification locally for the in-app notifications screen
          saveNotification({
            title: notification.title || "Notification",
            body: notification.body || "",
            data: notification.data,
          });
          window.dispatchEvent(new Event("notification-update"));

          // Toast + optional deep link
          const targetPath = getTargetPathFromNotificationData(notification.data);
          if (targetPath) {
            toast(notification.title || "Notification", {
              description: notification.body,
              action: {
                label: "View",
                onClick: () => navigateRef.current(targetPath),
              },
            });
          } else {
            toast(notification.title || "Notification", {
              description: notification.body,
            });
          }
        },
      );

      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action: ActionPerformed) => {
          console.log("Push notification action performed:", action);

          const notification = action.notification;
          saveNotification({
            title: notification.title || "Notification",
            body: notification.body || "",
            data: notification.data,
          });
          window.dispatchEvent(new Event("notification-update"));

          const targetPath = getTargetPathFromNotificationData(notification.data);
          if (targetPath) {
            // Always store for later (covers cold start before router/auth)
            pendingNotificationNavigation = targetPath;
            try {
              navigateRef.current(targetPath);
            } catch (navErr) {
              console.log("Navigation not ready, will retry:", navErr);
            }
          }
        },
      );

      const permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === "granted") {
        await PushNotifications.register();
      } else {
        console.log("Push notification permission not granted yet");
      }
    } catch (err) {
      console.error("Error initializing push notifications:", err);
    }
  }, [registerToken]);

  // Initialize ASAP on native (don’t wait for user/profile so we don't miss tap events)
  useEffect(() => {
    initializePushNotifications();

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
        didInitRef.current = false;
      }
    };
  }, [initializePushNotifications]);

  // If we received a token before auth/profile was ready, retry registration
  useEffect(() => {
    if (user && profile?.phone_suffix && latestTokenRef.current) {
      registerToken(latestTokenRef.current);
    }
  }, [user, profile?.phone_suffix, registerToken]);

  // Process pending navigation once user exists
  useEffect(() => {
    if (user) {
      const pendingPath = getPendingNotificationNavigation();
      if (pendingPath) {
        console.log("Processing pending notification navigation:", pendingPath);
        setTimeout(() => navigate(pendingPath), 100);
      }
    }
  }, [user, navigate]);

  return { initializePushNotifications };
}
