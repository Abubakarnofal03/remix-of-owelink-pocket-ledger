import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineDb, LocalBillNotice, generateLocalId, safeDbOperation } from "@/lib/offline/db";
import { addToSyncQueue } from "@/lib/offline/syncQueue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send, Trash2, Loader2, Pin, WifiOff } from "lucide-react";
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
  is_local?: boolean;
}

interface NoticeBoardProps {
  billId: string;
  billTitle: string;
  isCreator: boolean;
  userPhoneSuffix: string | null;
  participantPhoneSuffixes: string[];
  getContactName: (phoneSuffix: string) => string;
}

const NOTICE_COLORS = [
  "#f472b6", "#60a5fa", "#4ade80", "#facc15",
  "#fb923c", "#a78bfa", "#2dd4bf", "#f87171",
];

const getRotation = (id: string): number => {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rotations = [-2, 1, -1, 2, -1.5, 0.5, -0.5, 1.5];
  return rotations[hash % rotations.length];
};

const toPastel = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const pr = Math.round(r + (255 - r) * 0.6);
  const pg = Math.round(g + (255 - g) * 0.6);
  const pb = Math.round(b + (255 - b) * 0.6);
  return `rgb(${pr}, ${pg}, ${pb})`;
};

// Cache notices to IndexedDB
async function cacheNotices(notices: Notice[], billId: string): Promise<void> {
  await safeDbOperation(async () => {
    // Clear old notices for this bill then bulk add
    const existing = await offlineDb.billNotices.where('bill_id').equals(billId).toArray();
    const existingIds = new Set(existing.map(n => n.id));
    const newNotices: LocalBillNotice[] = notices
      .filter(n => !existingIds.has(n.id))
      .map(n => ({
        id: n.id,
        bill_id: n.bill_id,
        author_phone_suffix: n.author_phone_suffix,
        message: n.message,
        color: n.color,
        created_at: n.created_at,
        updated_at: n.created_at,
        synced_at: Date.now(),
        is_local: false,
      }));
    if (newNotices.length > 0) {
      await offlineDb.billNotices.bulkPut(newNotices);
    }
    // Update existing
    for (const n of notices) {
      if (existingIds.has(n.id)) {
        await offlineDb.billNotices.update(n.id, { synced_at: Date.now(), is_local: false });
      }
    }
    // Remove notices that no longer exist on server (deleted by others)
    const serverIds = new Set(notices.map(n => n.id));
    const toDelete = existing.filter(n => !serverIds.has(n.id) && !n.is_local);
    if (toDelete.length > 0) {
      await offlineDb.billNotices.bulkDelete(toDelete.map(n => n.id));
    }
  }, undefined);
}

// Load cached notices from IndexedDB
async function loadCachedNotices(billId: string): Promise<Notice[]> {
  return safeDbOperation(async () => {
    const cached = await offlineDb.billNotices.where('bill_id').equals(billId).toArray();
    return cached
      .map(n => ({
        id: n.id,
        bill_id: n.bill_id,
        author_phone_suffix: n.author_phone_suffix,
        message: n.message,
        color: n.color,
        created_at: n.created_at,
        is_local: n.is_local,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, []);
}

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

  useEffect(() => {
    const fetchNotices = async () => {
      // Load cached first for instant display
      const cached = await loadCachedNotices(billId);
      if (cached.length > 0) {
        setNotices(cached);
        setLoading(false);
      }

      // Then try server fetch
      try {
        const { data, error } = await supabase
          .from("bill_notices")
          .select("*")
          .eq("bill_id", billId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const serverNotices: Notice[] = data || [];
        
        // Merge: keep local-only notices that haven't synced yet
        const serverIds = new Set(serverNotices.map(n => n.id));
        const localOnly = cached.filter(n => n.is_local && !serverIds.has(n.id));
        const merged = [...localOnly, ...serverNotices];
        setNotices(merged);

        // Cache server data
        await cacheNotices(serverNotices, billId);
      } catch (error) {
        console.error("Error fetching notices:", error);
        // Offline - cached data already shown
      } finally {
        setLoading(false);
      }
    };

    fetchNotices();

    const channel = supabase
      .channel(`bill_notices_${billId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bill_notices", filter: `bill_id=eq.${billId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newNotice = payload.new as Notice;
            setNotices((prev) => {
              // Avoid duplicate if we already have it (from local creation)
              if (prev.some(n => n.id === newNotice.id)) {
                return prev.map(n => n.id === newNotice.id ? { ...newNotice, is_local: false } : n);
              }
              return [newNotice, ...prev];
            });
            // Cache the new notice
            await safeDbOperation(async () => {
              await offlineDb.billNotices.put({
                id: newNotice.id,
                bill_id: newNotice.bill_id,
                author_phone_suffix: newNotice.author_phone_suffix,
                message: newNotice.message,
                color: newNotice.color,
                created_at: newNotice.created_at,
                updated_at: newNotice.created_at,
                synced_at: Date.now(),
                is_local: false,
              });
            }, undefined);
          } else if (payload.eventType === "DELETE") {
            setNotices((prev) => prev.filter((n) => n.id !== payload.old.id));
            await safeDbOperation(async () => {
              await offlineDb.billNotices.delete(payload.old.id);
            }, undefined);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [billId]);

  const handleSubmit = async () => {
    if (!newMessage.trim() || !userPhoneSuffix) return;
    setSubmitting(true);

    const color = NOTICE_COLORS[Math.floor(Math.random() * NOTICE_COLORS.length)];
    const localId = generateLocalId();
    const now = new Date().toISOString();

    // Create local notice immediately
    const localNotice: Notice = {
      id: localId,
      bill_id: billId,
      author_phone_suffix: userPhoneSuffix,
      message: newMessage.trim(),
      color,
      created_at: now,
      is_local: true,
    };

    // Save to IndexedDB first
    await safeDbOperation(async () => {
      await offlineDb.billNotices.put({
        id: localId,
        bill_id: billId,
        author_phone_suffix: userPhoneSuffix,
        message: newMessage.trim(),
        color,
        created_at: now,
        updated_at: now,
        synced_at: undefined,
        is_local: true,
      });
    }, undefined);

    // Update UI immediately
    setNotices((prev) => [localNotice, ...prev]);
    setNewMessage("");

    try {
      // Try server insert
      const { data, error } = await supabase
        .from("bill_notices")
        .insert({ id: localId, bill_id: billId, author_phone_suffix: userPhoneSuffix, message: newMessage.trim(), color })
        .select()
        .single();

      if (error) throw error;

      // Mark as synced
      setNotices((prev) => prev.map(n => n.id === localId ? { ...n, is_local: false } : n));
      await safeDbOperation(async () => {
        await offlineDb.billNotices.update(localId, { synced_at: Date.now(), is_local: false });
      }, undefined);

      toast.success("Notice posted!");

      // Send push notifications
      const recipientSuffixes = participantPhoneSuffixes.filter((s) => s !== userPhoneSuffix);
      if (recipientSuffixes.length > 0) {
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
      // Queue for sync
      await addToSyncQueue('bill_notice', 'create', localId, {
        id: localId,
        bill_id: billId,
        author_phone_suffix: userPhoneSuffix,
        message: newMessage.trim(),
        color,
      });
      toast.success("Notice saved offline – will sync when online");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noticeId: string) => {
    // Remove from UI immediately
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));

    // Remove from local cache
    await safeDbOperation(async () => {
      await offlineDb.billNotices.delete(noticeId);
    }, undefined);

    try {
      const { error } = await supabase.from("bill_notices").delete().eq("id", noticeId);
      if (error) throw error;
      toast.success("Notice deleted");
    } catch (error) {
      console.error("Error deleting notice:", error);
      // Queue deletion for sync
      await addToSyncQueue('bill_notice', 'delete', noticeId, {});
      toast.success("Notice deleted offline – will sync when online");
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
        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground transition-transform", expanded && "rotate-180")}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Input */}
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
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">All participants will be notified</p>
            </div>
          )}

          {/* Sticky Notes Board */}
          <div className="p-4 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-yellow-50/60 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/20 min-h-[80px]">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : notices.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground text-sm">No notices yet</p>
                <p className="text-xs text-muted-foreground mt-1">Be the first to post!</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {notices.map((notice) => {
                  const rotation = getRotation(notice.id);
                  const pastelBg = toPastel(notice.color);
                  const isLong = notice.message.length > 80;

                  return (
                    <div
                      key={notice.id}
                      className={cn(
                        "relative group rounded-md shadow-md p-3 pt-5 transition-transform hover:scale-105 hover:z-10",
                        isLong ? "w-full sm:w-[calc(50%-6px)]" : "w-[calc(50%-6px)] sm:w-[calc(33%-8px)]"
                      )}
                      style={{
                        backgroundColor: pastelBg,
                        transform: `rotate(${rotation}deg)`,
                        borderBottom: `3px solid ${notice.color}`,
                      }}
                    >
                      {/* Pin */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                        <Pin className="h-4 w-4 text-gray-500 dark:text-gray-400 fill-gray-400 dark:fill-gray-500" />
                      </div>

                      {/* Offline indicator */}
                      {notice.is_local && (
                        <div className="absolute top-1 left-1">
                          <WifiOff className="h-3 w-3 text-amber-600" />
                        </div>
                      )}

                      {/* Author */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div
                          className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: notice.color }}
                        >
                          {getContactName(notice.author_phone_suffix).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-semibold truncate" style={{ color: notice.color }}>
                          {getContactName(notice.author_phone_suffix)}
                        </span>
                      </div>

                      {/* Message */}
                      <p className="text-xs text-gray-800 dark:text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
                        {notice.message}
                      </p>

                      {/* Time */}
                      <p className="text-[9px] text-gray-500 mt-2">
                        {format(new Date(notice.created_at), "MMM d, h:mm a")}
                      </p>

                      {/* Delete */}
                      {canDeleteNotice(notice) && (
                        <button
                          onClick={() => handleDelete(notice.id)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-500 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
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
}
