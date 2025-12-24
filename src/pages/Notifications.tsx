import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";
import { Button } from "@/components/ui/button";
import { Bell, Trash2, CheckCheck, Receipt, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Notifications() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, remove, clearAll, refresh } = useLocalNotifications();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const handleRefresh = async () => {
    refresh();
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    const data = notification.data;
    if (data?.type === "bill" && data?.id) {
      navigate(`/bills/${data.id}`);
    } else if (data?.type === "iou" && data?.id) {
      navigate(`/ious/${data.id}`);
    }
  };

  const getNotificationIcon = (data?: Record<string, any>) => {
    if (data?.type === "bill") return <Receipt className="h-4 w-4" />;
    if (data?.type === "iou") return <FileText className="h-4 w-4" />;
    return <Bell className="h-4 w-4" />;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead}>
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Read all
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="All caught up"
              description="You'll see payment reminders and updates here."
            />
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`card-elevated p-4 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all ${
                    !notification.read ? "border-l-4 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      notification.read 
                        ? "bg-muted" 
                        : "bg-primary/10"
                    }`}>
                      {getNotificationIcon(notification.data)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${
                          notification.read ? "text-muted-foreground" : "text-foreground"
                        }`}>
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(notification.id);
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.receivedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>
    </AppLayout>
  );
}
