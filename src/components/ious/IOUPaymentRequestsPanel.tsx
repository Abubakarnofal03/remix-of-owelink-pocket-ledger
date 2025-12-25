import { useState } from 'react';
import { format } from 'date-fns';
import { IOUPaymentRequest } from '@/hooks/useIOUPaymentRequests';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Check, X, Image, MessageSquare, Clock, CheckCircle, XCircle } from 'lucide-react';

interface IOUPaymentRequestsPanelProps {
  requests: IOUPaymentRequest[];
  currency: string;
  onApprove: (requestId: string) => Promise<boolean>;
  onReject: (requestId: string, reason?: string) => Promise<boolean>;
  getRequesterName?: (phoneSuffix: string) => string;
}

export function IOUPaymentRequestsPanel({
  requests,
  currency,
  onApprove,
  onReject,
  getRequesterName,
}: IOUPaymentRequestsPanelProps) {
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    await onApprove(requestId);
    setProcessing(null);
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setProcessing(rejectingId);
    await onReject(rejectingId, rejectReason.trim() || undefined);
    setProcessing(null);
    setRejectingId(null);
    setRejectReason('');
  };

  const getName = (phoneSuffix: string) => {
    return getRequesterName?.(phoneSuffix) || phoneSuffix;
  };

  if (requests.length === 0) return null;

  return (
    <div className="card-elevated p-4 space-y-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Payment Requests
        {pendingRequests.length > 0 && (
          <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
            {pendingRequests.length} pending
          </span>
        )}
      </h3>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          {pendingRequests.map((request) => (
            <div
              key={request.id}
              className="bg-muted/50 rounded-lg p-3 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {getName(request.requester_phone_suffix)}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(request.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
                <MoneyDisplay amount={request.amount_claimed} currency={currency} />
              </div>

              {request.message && (
                <p className="text-sm text-muted-foreground bg-background rounded p-2">
                  "{request.message}"
                </p>
              )}

              {request.receipt_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setViewingImage(request.receipt_url)}
                >
                  <Image className="h-4 w-4 mr-2" />
                  View Receipt
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleApprove(request.id)}
                  disabled={processing === request.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setRejectingId(request.id)}
                  disabled={processing === request.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="processed" className="border-none">
            <AccordionTrigger className="text-sm text-muted-foreground py-2">
              Past Requests ({processedRequests.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {processedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between bg-muted/30 rounded-lg p-2"
                  >
                    <div className="flex items-center gap-2">
                      {request.status === 'approved' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500" />
                      )}
                      <span className="text-sm text-foreground">
                        {getName(request.requester_phone_suffix)}
                      </span>
                    </div>
                    <MoneyDisplay amount={request.amount_claimed} currency={currency} size="sm" />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Receipt Image Modal */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <img
              src={viewingImage}
              alt="Receipt"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Optionally provide a reason for rejection:
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRejectingId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
