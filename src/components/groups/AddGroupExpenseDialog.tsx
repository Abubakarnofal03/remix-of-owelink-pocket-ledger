import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpenseGroupMember } from "@/hooks/useExpenseGroups";
import { Loader2, Info } from "lucide-react";

interface AddGroupExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ExpenseGroupMember[];
  isCreator: boolean;
  currentUserMemberId?: string | null;
  onSubmit: (data: { paid_by_member_id: string; amount: number; description?: string; split_type?: string }) => Promise<any>;
}

export function AddGroupExpenseDialog({ open, onOpenChange, members, isCreator, currentUserMemberId, onSubmit }: AddGroupExpenseDialogProps) {
  const [paidBy, setPaidBy] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [splitType, setSplitType] = useState("equal");
  const [submitting, setSubmitting] = useState(false);

  // Default the payer: creator can pick anyone, non-creator is locked to themselves
  useEffect(() => {
    if (!open) return;
    if (!isCreator && currentUserMemberId) {
      setPaidBy(currentUserMemberId);
    } else if (isCreator && !paidBy && currentUserMemberId) {
      setPaidBy(currentUserMemberId);
    }
  }, [open, isCreator, currentUserMemberId]);

  const handleSubmit = async () => {
    if (!paidBy || !amount) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        paid_by_member_id: paidBy,
        amount: amountNum,
        description: description.trim() || undefined,
        split_type: splitType,
      });
      setPaidBy("");
      setAmount("");
      setDescription("");
      setSplitType("equal");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const onBehalfOf = isCreator && paidBy && paidBy !== currentUserMemberId
    ? members.find(m => m.id === paidBy)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Who paid?</label>
            <Select value={paidBy} onValueChange={setPaidBy} disabled={!isCreator}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nickname || m.phone_number}{m.id === currentUserMemberId ? ' (You)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isCreator && (
              <p className="text-xs text-muted-foreground mt-1">
                Only the group creator can record expenses paid by other members.
              </p>
            )}
            {onBehalfOf && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-foreground">
                  Adding on behalf of <span className="font-semibold">{onBehalfOf.nickname || onBehalfOf.phone_number}</span>
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Split type</label>
            <Select value={splitType} onValueChange={setSplitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Split equally</SelectItem>
                <SelectItem value="exact">Exact amounts</SelectItem>
                <SelectItem value="percentage">By percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {splitType === 'equal' && members.length > 0 && amount && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Each person pays:{' '}
                <span className="font-medium text-foreground">
                  {(parseFloat(amount) / members.length).toFixed(2)}
                </span>
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !paidBy || !amount}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
