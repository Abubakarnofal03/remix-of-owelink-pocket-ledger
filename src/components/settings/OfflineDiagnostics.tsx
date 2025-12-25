import { useState } from 'react';
import { useOffline } from '@/hooks/useOffline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Trash2,
  RotateCcw,
  CloudOff,
  Cloud
} from 'lucide-react';
import { toast } from 'sonner';

export function OfflineDiagnostics() {
  const { 
    status, 
    pendingCount, 
    failedCount, 
    lastSyncAt, 
    dbDiagnostics,
    sync,
    fullSync,
    clearData,
    retryFailed,
    testDb,
  } = useOffline();
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testDb();
      setTestResult(result);
      if (result.success) {
        toast.success('Database test passed');
      } else {
        toast.error('Database test failed: ' + result.error);
      }
    } catch (e) {
      setTestResult({ success: false, error: String(e) });
      toast.error('Database test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleClearData = async () => {
    if (confirm('This will clear all locally cached data. Are you sure?')) {
      await clearData();
      toast.success('Local data cleared');
    }
  };

  const handleRetryFailed = async () => {
    await retryFailed();
    toast.success('Retrying failed sync items');
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'online' && <Cloud className="h-4 w-4 text-emerald-500" />}
          {status === 'offline' && <CloudOff className="h-4 w-4 text-amber-500" />}
          {status === 'syncing' && <RefreshCw className="h-4 w-4 text-primary animate-spin" />}
          <span className="font-medium capitalize">{status}</span>
        </div>
        <Badge variant={dbDiagnostics.isReady ? "default" : "destructive"}>
          DB: {dbDiagnostics.isReady ? 'Ready' : 'Not Ready'}
        </Badge>
      </div>

      {/* Sync Status */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Pending Sync</span>
          <span className="font-medium">{pendingCount} items</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Failed</span>
          <span className={`font-medium ${failedCount > 0 ? 'text-destructive' : ''}`}>
            {failedCount} items
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Last Sync</span>
          <span className="font-medium">{formatTime(lastSyncAt)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">Platform</span>
          <span className="font-medium">{dbDiagnostics.platform}</span>
        </div>
      </div>

      {/* Error Display */}
      {dbDiagnostics.lastError && (
        <div className="p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive break-all">{dbDiagnostics.lastError}</p>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={`p-3 rounded-lg flex items-start gap-2 ${
          testResult.success ? 'bg-emerald-500/10' : 'bg-destructive/10'
        }`}>
          {testResult.success ? (
            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive mt-0.5" />
          )}
          <p className="text-xs break-all">
            {testResult.success ? 'Read/write test passed' : testResult.error}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => sync()}
            disabled={status === 'syncing'}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => fullSync()}
            disabled={status === 'syncing'}
          >
            <Database className="h-4 w-4 mr-1" />
            Full Sync
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleTest}
            disabled={testing}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {testing ? 'Testing...' : 'Test DB'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleRetryFailed}
            disabled={failedCount === 0}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Retry Failed
          </Button>
        </div>

        <Button 
          variant="destructive" 
          size="sm" 
          className="w-full"
          onClick={handleClearData}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear Local Data
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Init attempts: {dbDiagnostics.initAttempts} • 
        Last init: {formatTime(dbDiagnostics.lastInitTime)}
      </p>
    </div>
  );
}
