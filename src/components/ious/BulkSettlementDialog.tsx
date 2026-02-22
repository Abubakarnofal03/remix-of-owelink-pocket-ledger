import { useState, useMemo } from "react";
import { IOU } from "@/hooks/useIOUs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Calculator } from "lucide-react";
import { toast } from "sonner";

interface Allocation {
  iou: IOU;
  applied: number;
  newPaid: number;
  fullyPaid: boolean;
  remaining: number;
}

interface BulkSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  pendingIOUs: IOU[];
  currency: string;
  onConfirm: (allocations: { id: string; amount_paid: number; status: string }[]) => Promise<void>;
}

function allocatePayment(pendingIOUs: IOU[], totalPayment: number): { allocations: Allocation[]; leftover: number } {
  const sorted = [...pendingIOUs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let remaining = totalPayment;
  const allocations: Allocation[] = [];

  for (const iou of sorted) {
    if (remaining <= 0) break;
    const owed = iou.amount - iou.amount_paid;
    const apply = Math.min(remaining, owed);
    allocations.push({
      iou,
      applied: apply,
      newPaid: iou.amount_paid + apply,
      fullyPaid: apply >= owed,
      remaining: owed - apply,
    });
    remaining -= apply;
  }

  return { allocations, leftover: remaining };
}

export function BulkSettlementDialog({
  open,
  onOpenChange,
  personName,
  pendingIOUs,
  currency,
  onConfirm,
}: BulkSettlementDialogProps) {
  const [step, setStep] = useState<"input" | "preview">("input");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalRemaining = useMemo(
    () => pendingIOUs.reduce((sum, iou) => sum + (iou.amount - iou.amount_paid), 0),
    [pendingIOUs]
  );

  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount > 0 && parsedAmount <= totalRemaining;

  const { allocations, leftover } = useMemo(
    () => (step === "preview" ? allocatePayment(pendingIOUs, parsedAmount) : { allocations: [], leftover: 0 }),
    [step, pendingIOUs, parsedAmount]
  );

  const handleCalculate = () => {
    if (!isValid) return;
    setStep("preview");
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const updates = allocations.map((a) => ({
        id: a.iou.id,
        amount_paid: a.newPaid,
        status: a.fullyPaid ? "paid" : "partial",
      }));
      await onConfirm(updates);
      toast.success(`${currency} ${parsedAmount.toLocaleString()} settled across ${allocations.length} IOUs`);
      handleClose();
    } catch {
      toast.error("Failed to apply settlement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("input");
    setAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {step === "input" ? `Settle with ${personName}` : "Settlement Preview"}
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              How much did <span className="font-semibold text-foreground">{personName}</span> pay in total?
              The amount will be distributed across their {pendingIOUs.length} pending IOU{pendingIOUs.length !== 1 ? "s" : ""} (oldest first).
            </p>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Outstanding</p>
              <MoneyDisplay amount={totalRemaining} currency={currency} size="lg" className="text-foreground font-bold" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Payment Amount</label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                max={totalRemaining}
                step="any"
                autoFocus
              />
              {parsedAmount > totalRemaining && (
                <p className="text-xs text-destructive mt-1">Amount exceeds total outstanding ({currency} {totalRemaining.toLocaleString()})</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleCalculate} disabled={!isValid}>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Settling</p>
              <MoneyDisplay amount={parsedAmount} currency={currency} size="lg" className="text-primary font-bold" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Breakdown</p>
              {allocations.map((a) => (
                <div key={a.iou.id} className="p-3 rounded-lg border border-border bg-card space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate flex-1">
                      {a.iou.description || "Untitled IOU"}
                    </p>
                    <Badge variant={a.fullyPaid ? "default" : "secondary"} className="shrink-0 text-[10px]">
                      {a.fullyPaid ? "Fully Paid" : "Partial"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Total: {currency} {a.iou.amount.toLocaleString()}</span>
                    <span className="text-primary font-semibold">
                      Applying: {currency} {a.applied.toLocaleString()}
                    </span>
                  </div>
                  {!a.fullyPaid && (
                    <p className="text-xs text-muted-foreground">
                      Remaining after: {currency} {a.remaining.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={isSubmitting}>
                <Check className="h-4 w-4 mr-2" />
                {isSubmitting ? "Applying..." : "Confirm Settlement"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
