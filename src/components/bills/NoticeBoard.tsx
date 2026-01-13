import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Megaphone, Send, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getPhoneSuffix, sendPushNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface Notice {
  id: string;
  bill_id: string;
  author_phone_suffix: string;
  message: string;
  color: string;
  created_at: string;
}

interface NoticeBoardProps {
  billId: string;
  billTitle: string;
  isCreator: boolean;
  userPhoneSuffix: string | null;
  participantPhoneSuffixes: string[];
  getContactName: (phoneSuffix: string) => string;
}

// Bright, cheerful colors for notices
const NOTICE_COLORS = [
  "#f472b6", // pink
  "#60a5fa", // blue
  "#4ade80", // green
  "#facc15", // yellow
  "#fb923c", // orange
  "#a78bfa", // purple
  "#2dd4bf", // teal
  "#f87171", // red
];

export function NoticeBoard({
  billId,
  billTitle,
  isCreator,
  userPhoneSuffix,
  participantPhoneSuffixes,
  getContactName,
}: NoticeBoardProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Fetch notices
  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const { data, error } = await supabase
          .from("bill_notices")
          .select("*")
          .eq("bill_id", billId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNotices(data || []);
      } catch (error) {
        console.error("Error fetching notices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotices();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`bill_notices_${billId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bill_notices",
          filter: `bill_id=eq.${billId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setNotices((prev) => [payload.new as Notice, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setNotices((prev) => prev.filter((n) => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [billId]);

  const handleSubmit = async () => {
    if (!newMessage.trim() || !userPhoneSuffix) return;

    setSubmitting(true);
    try {
      // Pick a random color
      const color = NOTICE_COLORS[Math.floor(Math.random() * NOTICE_COLORS.length)];

      const { data, error } = await supabase
        .from("bill_notices")
        .insert({
          bill_id: billId,
          author_phone_suffix: userPhoneSuffix,
          message: newMessage.trim(),
          color,
        })
        .select()
        .single();

      if (error) throw error;

      setNotices((prev) => [data, ...prev]);
      setNewMessage("");
      toast.success("Notice posted!");

      // Send push notification to all participants (except author)
      const recipientSuffixes = participantPhoneSuffixes.filter(
        (s) => s !== userPhoneSuffix
      );
      if (recipientSuffixes.length > 0 && navigator.onLine) {
        const authorName = getContactName(userPhoneSuffix);
        sendPushNotification({
          phoneSuffixes: recipientSuffixes,
          title: `📢 Notice: ${billTitle}`,
          body: `${authorName}: ${newMessage.slice(0, 100)}${newMessage.length > 100 ? "..." : ""}`,
          data: { type: "bill", id: billId },
        });
      }
    } catch (error) {
      console.error("Error posting notice:", error);
      toast.error("Failed to post notice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noticeId: string) => {
    try {
      const { error } = await supabase
        .from("bill_notices")
        .delete()
        .eq("id", noticeId);

      if (error) throw error;
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
      toast.success("Notice deleted");
    } catch (error) {
      console.error("Error deleting notice:", error);
      toast.error("Failed to delete notice");
    }
  };

  const canDeleteNotice = (notice: Notice) => {
    return isCreator || notice.author_phone_suffix === userPhoneSuffix;
  };

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
      >
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground">Notice Board</h3>
          <p className="text-xs text-muted-foreground">
            {notices.length} {notices.length === 1 ? "notice" : "notices"}
          </p>
        </div>
        <div
          className={cn(
            "h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Input for new notice */}
          {userPhoneSuffix && (
            <div className="p-4 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-b border-border">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Post an announcement or ask a question..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={2}
                  className="resize-none bg-background"
                  maxLength={500}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!newMessage.trim() || submitting}
                  size="icon"
                  className="h-auto aspect-square bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                All participants will be notified
              </p>
            </div>
          )}

          {/* Notices list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : notices.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground text-sm">No notices yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Be the first to post an announcement!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notices.map((notice) => (
                  <div key={notice.id} className="p-4 relative group">
                    <div className="flex gap-3">
                      <div
                        className="h-1 w-1 rounded-full mt-2 flex-shrink-0"
                        style={{ backgroundColor: notice.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                            style={{ backgroundColor: notice.color }}
                          >
                            {getContactName(notice.author_phone_suffix).charAt(0).toUpperCase()}
                          </div>
                          <span
                            className="font-medium text-sm"
                            style={{ color: notice.color }}
                          >
                            {getContactName(notice.author_phone_suffix)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(notice.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {notice.message}
                        </p>
                      </div>
                      {canDeleteNotice(notice) && (
                        <button
                          onClick={() => handleDelete(notice.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
