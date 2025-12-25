import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PendingSyncSheet } from "./PendingSyncSheet";

interface SyncStatusProps {
  status: 'online' | 'offline' | 'syncing';
  pendingCount: number;
  className?: string;
  onSyncComplete?: () => void;
}

export function SyncStatus({ status, pendingCount, className, onSyncComplete }: SyncStatusProps) {
  // Only show if offline OR if there are pending items
  if (status === 'online' && pendingCount === 0) {
    return null;
  }

  const isOnline = status === 'online' || status === 'syncing';

  const badgeContent = (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer hover:opacity-80",
        status === 'offline' && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
        status === 'syncing' && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
        status === 'online' && pendingCount > 0 && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
        className
      )}
    >
      {status === 'offline' && (
        <>
          <CloudOff className="h-3 w-3" />
          <span>Offline</span>
          {pendingCount > 0 && (
            <span className="bg-amber-200 dark:bg-amber-800 px-1 rounded text-[10px]">
              {pendingCount}
            </span>
          )}
        </>
      )}
      
      {status === 'syncing' && (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Syncing</span>
          {pendingCount > 0 && (
            <span className="bg-blue-200 dark:bg-blue-800 px-1 rounded text-[10px]">
              {pendingCount}
            </span>
          )}
        </>
      )}
      
      {status === 'online' && pendingCount > 0 && (
        <>
          <Cloud className="h-3 w-3" />
          <span>Pending</span>
          <span className="bg-blue-200 dark:bg-blue-800 px-1 rounded text-[10px]">
            {pendingCount}
          </span>
        </>
      )}
    </div>
  );

  return (
    <PendingSyncSheet 
      trigger={badgeContent} 
      isOnline={isOnline}
      onSyncComplete={onSyncComplete}
    />
  );
}
