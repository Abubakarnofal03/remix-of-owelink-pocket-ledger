import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
  status: 'online' | 'offline' | 'syncing';
  pendingCount: number;
  className?: string;
}

export function SyncStatus({ status, pendingCount, className }: SyncStatusProps) {
  if (status === 'online' && pendingCount === 0) {
    return null; // Don't show anything when fully synced
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300",
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
}
