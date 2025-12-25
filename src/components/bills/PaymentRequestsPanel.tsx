import { useState } from 'react';
import { PaymentRequest } from '@/hooks/usePaymentRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { Check, X, Image as ImageIcon, Clock, Loader2 } from 'lucide-react';

interface PaymentRequestsPanelProps {
  requests: PaymentRequest[];
  currency: string;
  onApprove: (requestId: string) => Promise<boolean>;
  onReject: (requestId: string, reason?: string) => Promise<boolean>;
  getContactName: (phoneSuffix: string) => string;
}

export function PaymentRequestsPanel({
  requests,
  currency,
  onApprove,
  onReject,
  getContactName,
}: PaymentRequestsPanelProps) {
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await onApprove(requestId);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;
    setProcessing(rejectingRequest);
    try {
      await onReject(rejectingRequest, rejectReason);
      setRejectingRequest(null);
      setRejectReason('');
    } finally {
      setProcessing(null);
    }
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="card-elevated p-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending Requests ({pendingRequests.length})
          </h3>
          
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-muted/50 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {getContactName(request.requester_phone_suffix)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <MoneyDisplay
                    amount={request.amount_claimed}
                    currency={currency}
                    size="sm"
                    className="font-semibold"
                  />
                </div>

                {request.message && (
                  <p className="text-sm text-muted-foreground bg-background/50 rounded p-2">
                    "{request.message}"
                  </p>
                )}

                {request.receipt_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingReceipt(request.receipt_url)}
                    className="w-full"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    View Receipt
                  </Button>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setRejectingRequest(request.id)}
                    disabled={processing === request.id}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleApprove(request.id)}
                    disabled={processing === request.id}
                  >
                    {processing === request.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed Requests History */}
      {processedRequests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Request History
          </h4>
          {processedRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
            >
              <div className="flex items-center gap-2">
                <span>{getContactName(request.requester_phone_suffix)}</span>
                <Badge
                  variant={request.status === 'approved' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {request.status}
                </Badge>
              </div>
              <MoneyDisplay
                amount={request.amount_claimed}
                currency={currency}
                size="sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Receipt Viewer Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <img
              src={viewingReceipt}
              alt="Payment receipt"
              className="w-full max-h-[60vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation */}
      <AlertDialog open={!!rejectingRequest} onOpenChange={() => setRejectingRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Payment Request?</AlertDialogTitle>
            <AlertDialogDescription>
              You can optionally provide a reason for rejecting this request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
