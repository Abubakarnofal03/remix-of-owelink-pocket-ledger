import { useState, useEffect } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, FileText, Receipt, CreditCard, User, Check, AlertCircle } from "lucide-react";
import { offlineDb, SyncQueueItem } from "@/lib/offline/db";
import { processSyncItem } from "@/lib/offline/syncQueue";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PendingItemDisplay {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  action_id: string;
  last_error: string | null;
  displayName: string;
  displayType: string;
}

interface PendingSyncSheetProps {
  trigger: React.ReactNode;
  isOnline: boolean;
  onSyncComplete?: () => void;
}

export function PendingSyncSheet({ trigger, isOnline, onSyncComplete }: PendingSyncSheetProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PendingItemDisplay[]>([]);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadPendingItems = async () => {
    setLoading(true);
    try {
      await offlineDb.ensureReady();
      const pendingItems = await offlineDb.syncQueue
        .where('status')
        .anyOf(['pending', 'failed'])
        .toArray();

      // Enrich items with display names
      const enrichedItems: PendingItemDisplay[] = await Promise.all(
        pendingItems.map(async (item) => {
          let displayName = 'Unknown';
          let displayType = 'Item';

          try {
            if (item.entity_type === 'bill') {
              const bill = await offlineDb.bills.get(item.entity_id);
              displayName = bill?.title || 'Unknown Bill';
              displayType = 'Bill';
            } else if (item.entity_type === 'iou') {
              const iou = await offlineDb.ious.get(item.entity_id);
              displayName = iou?.description || `${iou?.currency} ${iou?.amount}` || 'Unknown IOU';
              displayType = 'IOU';
            } else if (item.entity_type === 'bill_participant') {
              displayName = (item.payload as any)?.phone_number || 'Participant';
              displayType = 'Participant';
            } else if (item.entity_type === 'payment') {
              displayName = `${(item.payload as any)?.currency || ''} ${(item.payload as any)?.amount || ''}`;
              displayType = 'Payment';
            } else if (item.entity_type === 'contact') {
              displayName = (item.payload as any)?.nickname || (item.payload as any)?.phone_number || 'Contact';
              displayType = 'Contact';
            }
          } catch (e) {
            console.warn('Error enriching sync item:', e);
          }

          return {
            id: item.id!,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            operation: item.operation,
            payload: item.payload,
            status: item.status,
            retry_count: item.retry_count,
            action_id: item.action_id,
            last_error: item.last_error,
            displayName,
            displayType,
          };
        })
      );

      setItems(enrichedItems);
    } catch (e) {
      console.error('[PendingSyncSheet] Error loading items:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadPendingItems();
    }
  }, [open]);

  const handleSyncItem = async (item: PendingItemDisplay) => {
    if (!isOnline) {
      toast.error("Cannot sync while offline");
      return;
    }

    setSyncingIds(prev => new Set(prev).add(item.id));

    try {
      // Convert back to SyncQueueItem format
      const syncItem: SyncQueueItem = {
        id: item.id,
        entity_type: item.entity_type as SyncQueueItem['entity_type'],
        entity_id: item.entity_id,
        operation: item.operation as SyncQueueItem['operation'],
        payload: item.payload,
        status: item.status as SyncQueueItem['status'],
        retry_count: item.retry_count,
        created_at: Date.now(),
        action_id: item.action_id,
        last_error: item.last_error,
      };
      
      const success = await processSyncItem(syncItem);
      if (success) {
        toast.success(`Synced ${item.displayType}: ${item.displayName}`);
        // Remove from list
        setItems(prev => prev.filter(i => i.id !== item.id));
        onSyncComplete?.();
      } else {
        toast.error(`Failed to sync ${item.displayName}`);
        // Reload to get updated error state
        await loadPendingItems();
      }
    } catch (e) {
      console.error('Error syncing item:', e);
      toast.error("Sync failed");
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    if (!isOnline) {
      toast.error("Cannot sync while offline");
      return;
    }

    for (const item of items) {
      await handleSyncItem(item);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Bill': return FileText;
      case 'IOU': return Receipt;
      case 'Payment': return CreditCard;
      case 'Participant': return User;
      default: return FileText;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] sm:w-[400px]">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center justify-between">
            <span>Pending Sync ({items.length})</span>
            {isOnline && items.length > 0 && (
              <Button size="sm" onClick={handleSyncAll} disabled={syncingIds.size > 0}>
                <RefreshCw className={cn("h-4 w-4 mr-1", syncingIds.size > 0 && "animate-spin")} />
                Sync All
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-sm font-medium">All synced!</p>
              <p className="text-xs text-muted-foreground">No pending changes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const Icon = getIcon(item.displayType);
                const isSyncing = syncingIds.has(item.id);
                const isFailed = item.status === 'failed';

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      isFailed ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"
                    )}
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center",
                      isFailed ? "bg-destructive/10" : "bg-primary/10"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        isFailed ? "text-destructive" : "text-primary"
                      )} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.displayName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{item.operation}</span>
                        <span>•</span>
                        <span>{item.displayType}</span>
                        {isFailed && (
                          <>
                            <span>•</span>
                            <span className="text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Failed ({item.retry_count}x)
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {isOnline && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleSyncItem(item)}
                        disabled={isSyncing}
                      >
                        <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
