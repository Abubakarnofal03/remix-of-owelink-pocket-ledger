import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Sparkles, Bell, MessageSquare, ChevronRight } from 'lucide-react';
import {
  isTxnDetectionSupported,
  hasNotificationAccess,
  requestNotificationAccess,
  hasSmsPermission,
  requestSmsPermission,
} from '@/lib/txnDetection/nativeBridge';
import {
  isTxnDetectionEnabled,
  setTxnDetectionEnabled,
  isAutoIgnoreLow,
  setAutoIgnoreLow,
} from '@/hooks/useTxnDetection';
import { countPendingSuggestions } from '@/lib/txnDetection/suggestionStore';
import { toast } from 'sonner';

export function TxnDetectionSettings() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(isTxnDetectionEnabled());
  const [autoIgnore, setAutoIgnore] = useState(isAutoIgnoreLow());
  const [notifAccess, setNotifAccess] = useState(false);
  const [smsAccess, setSmsAccess] = useState(false);
  const [pending, setPending] = useState(0);

  const refresh = async () => {
    setNotifAccess(await hasNotificationAccess());
    setSmsAccess(await hasSmsPermission());
    setPending(await countPendingSuggestions());
  };

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  if (!isTxnDetectionSupported()) return null;

  return (
    <div className="card-elevated p-4 space-y-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Smart Expense Detection
      </h3>
      <p className="text-xs text-muted-foreground">
        Detect transactions from your bank and wallet notifications and turn them
        into expense suggestions. Nothing is auto-saved — you confirm every one.
        All parsing happens on this device.
      </p>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Enable detection</p>
          <p className="text-xs text-muted-foreground">Turn the whole feature on or off</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            setTxnDetectionEnabled(v);
            setEnabled(v);
            if (v) toast.success('Detection enabled. Grant notification access below.');
          }}
        />
      </div>

      {enabled && (
        <>
          <button
            className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
            onClick={async () => { await requestNotificationAccess(); setTimeout(refresh, 500); }}
          >
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm font-medium">Notification access</p>
                <p className="text-xs text-muted-foreground">
                  {notifAccess ? 'Granted' : 'Required — tap to open Android settings'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
            onClick={async () => { await requestSmsPermission(); setTimeout(refresh, 500); }}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm font-medium">SMS access (optional)</p>
                <p className="text-xs text-muted-foreground">
                  {smsAccess ? 'Granted' : 'Catch bank SMS alerts as backup'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-ignore low confidence</p>
              <p className="text-xs text-muted-foreground">Skip uncertain detections silently</p>
            </div>
            <Switch
              checked={autoIgnore}
              onCheckedChange={(v) => { setAutoIgnoreLow(v); setAutoIgnore(v); }}
            />
          </div>

          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => navigate('/suggestions')}
          >
            <span>Pending suggestions</span>
            <span className="text-sm text-muted-foreground">{pending}</span>
          </Button>
        </>
      )}
    </div>
  );
}
