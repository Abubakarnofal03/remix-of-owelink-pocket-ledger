// Local storage for push notifications
const NOTIFICATIONS_KEY = "local_notifications";

export interface LocalNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  receivedAt: string;
  read: boolean;
}

export function getLocalNotifications(): LocalNotification[] {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveNotification(notification: Omit<LocalNotification, "id" | "receivedAt" | "read">): LocalNotification {
  const notifications = getLocalNotifications();
  const newNotification: LocalNotification = {
    id: crypto.randomUUID(),
    title: notification.title,
    body: notification.body,
    data: notification.data,
    receivedAt: new Date().toISOString(),
    read: false,
  };
  
  // Add to beginning (newest first), limit to 50 notifications
  notifications.unshift(newNotification);
  const trimmed = notifications.slice(0, 50);
  
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed));
  return newNotification;
}

export function markNotificationAsRead(id: string): void {
  const notifications = getLocalNotifications();
  const updated = notifications.map(n => 
    n.id === id ? { ...n, read: true } : n
  );
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
}

export function markAllNotificationsAsRead(): void {
  const notifications = getLocalNotifications();
  const updated = notifications.map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
}

export function deleteNotification(id: string): void {
  const notifications = getLocalNotifications();
  const filtered = notifications.filter(n => n.id !== id);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
}

export function clearAllNotifications(): void {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
}

export function getUnreadCount(): number {
  return getLocalNotifications().filter(n => !n.read).length;
}
