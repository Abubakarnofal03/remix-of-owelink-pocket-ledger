import { useState } from "react";
import { Dispute } from "@/hooks/useDisputes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle } from "lucide-react";

interface DisputeResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispute: Dispute;
  currency?: string;
  onAccept: (response?: string) => Promise<void>;
  onReject: (response?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function DisputeResponseDialog({
  open,
  onOpenChange,
  dispute,
  currency,
  onAccept,
  onReject,
  isSubmitting,
}: DisputeResponseDialogProps) {
  const [response, setResponse] = useState("");

  const handleAccept = async () => {
    await onAccept(response.trim() || undefined);
    setResponse("");
    onOpenChange(false);
  };

  const handleReject = async () => {
    await onReject(response.trim() || undefined);
    setResponse("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Respond to Dispute</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Reason:</p>
            <p className="text-muted-foreground">{dispute.reason}</p>
            {dispute.proposed_amount !== null && (
              <p className="mt-1 text-muted-foreground">
                Proposed amount: <span className="font-medium text-foreground">{currency} {dispute.proposed_amount.toFixed(2)}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Your response (optional)</Label>
            <Textarea
              placeholder="Add a message..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isSubmitting}
            className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
