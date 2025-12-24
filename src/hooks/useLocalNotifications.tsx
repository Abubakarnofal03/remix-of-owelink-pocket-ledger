import { useState, useEffect, useCallback } from "react";
import { 
  getLocalNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  getUnreadCount,
  LocalNotification 
} from "@/lib/localNotifications";

export function useLocalNotifications() {
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    setNotifications(getLocalNotifications());
    setUnreadCount(getUnreadCount());
  }, []);

  useEffect(() => {
    refresh();
    
    // Listen for storage changes (e.g., when notification is received)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "local_notifications") {
        refresh();
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    
    // Also set up a custom event listener for same-tab updates
    const handleNotificationUpdate = () => refresh();
    window.addEventListener("notification-update", handleNotificationUpdate);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("notification-update", handleNotificationUpdate);
    };
  }, [refresh]);

  const markAsRead = useCallback((id: string) => {
    markNotificationAsRead(id);
    refresh();
  }, [refresh]);

  const markAllAsRead = useCallback(() => {
    markAllNotificationsAsRead();
    refresh();
  }, [refresh]);

  const remove = useCallback((id: string) => {
    deleteNotification(id);
    refresh();
  }, [refresh]);

  const clearAll = useCallback(() => {
    clearAllNotifications();
    refresh();
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
    refresh,
  };
}
