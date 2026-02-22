import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface DisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "iou" | "bill";
  entityId: string;
  currentAmount: number;
  currency: string;
  onSubmit: (data: { reason: string; proposed_amount?: number }) => Promise<void>;
  isSubmitting?: boolean;
}

export function DisputeDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  currentAmount,
  currency,
  onSubmit,
  isSubmitting,
}: DisputeDialogProps) {
  const [reason, setReason] = useState("");
  const [proposedAmount, setProposedAmount] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    await onSubmit({
      reason: reason.trim(),
      proposed_amount: proposedAmount ? parseFloat(proposedAmount) : undefined,
    });
    setReason("");
    setProposedAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Dispute {entityType === "bill" ? "Bill" : "Owe"} Amount
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Current amount: <span className="font-medium text-foreground">{currency} {currentAmount.toFixed(2)}</span>
          </p>

          <div className="space-y-2">
            <Label>Reason for dispute *</Label>
            <Textarea
              placeholder="Explain why you think the amount is incorrect..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Proposed amount (optional)</Label>
            <Input
              type="number"
              placeholder={`What you think it should be`}
              value={proposedAmount}
              onChange={(e) => setProposedAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? "Filing..." : "File Dispute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
