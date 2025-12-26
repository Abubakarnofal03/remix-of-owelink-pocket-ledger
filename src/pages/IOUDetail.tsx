import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIOUDetail, useIOUs } from "@/hooks/useIOUs";
import { useContacts } from "@/hooks/useContacts";
import { useIOUPaymentRequests } from "@/hooks/useIOUPaymentRequests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Skeleton } from "@/components/ui/skeleton";
import { IOUPaymentRequestDialog } from "@/components/ious/IOUPaymentRequestDialog";
import { IOUPaymentRequestsPanel } from "@/components/ious/IOUPaymentRequestsPanel";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Edit,
  Trash2,
  DollarSign,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  Archive,
  MessageCircle,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPhoneSuffix } from "@/lib/notifications";
import { formatPhoneForWhatsApp } from "@/lib/phoneUtils";

export default function IOUDetail() {
  const { user, profile, loading: authLoading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { iou, loading, updateIOULocally } = useIOUDetail(id);
  const { updateIOU, deleteIOU } = useIOUs();
  const { contacts } = useContacts();
  const { requests, createRequest, updateRequestStatus } = useIOUPaymentRequests(id);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPaymentRequestDialog, setShowPaymentRequestDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    due_date: "",
  });

  if (authLoading || loading) {
    return (
      <AppLayout hideNav>
        <div className="space-y-4 animate-fade-in">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!iou) {
    return (
      <AppLayout hideNav>
        <div className="text-center py-12">
          <p className="text-muted-foreground">IOU not found</p>
          <Button variant="link" onClick={() => navigate("/ious")}>
            Go back to IOUs
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isCreditor = iou.creditor_id === user.id;
  const remaining = iou.amount - iou.amount_paid;
  const progress = iou.amount > 0 ? (iou.amount_paid / iou.amount) * 100 : 0;

  // Check if current user is the debtor
  const userPhoneSuffix = profile?.phone_suffix || (profile?.phone_number ? getPhoneSuffix(profile.phone_number) : null);
  const isDebtor = useMemo(() => {
    if (!userPhoneSuffix) return false;
    if (iou.debtor_user_id === user.id) return true;
    const iouDebtorSuffix = iou.debtor_phone_suffix || getPhoneSuffix(iou.debtor_phone_number);
    return iouDebtorSuffix === userPhoneSuffix;
  }, [iou, user.id, userPhoneSuffix]);

  // Pending payment requests count
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  const getContactName = (phone: string) => {
    const contact = contacts.find(c => c.phone_number === phone);
    return contact?.nickname || phone;
  };

  // Helper to get contact name by phone suffix
  const getContactNameBySuffix = (phoneSuffix: string) => {
    const contact = contacts.find(c => {
      const suffix = c.phone_suffix || getPhoneSuffix(c.phone_number);
      return suffix === phoneSuffix;
    });
    return contact?.nickname || phoneSuffix;
  };

  const debtorName = getContactName(iou.debtor_phone_number);

  // Handle payment request submission from debtor
  const handlePaymentRequestSubmit = async (data: {
    amount_claimed: number;
    receipt_url?: string;
    message?: string;
  }) => {
    return await createRequest({
      iou_id: iou.id,
      amount_claimed: data.amount_claimed,
      receipt_url: data.receipt_url,
      message: data.message,
    });
  };

  // Handle approving a payment request (for creditors)
  const handleApproveRequest = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return false;

    const success = await updateRequestStatus(requestId, 'approved');
    if (success) {
      // Update IOU payment status
      const newAmountPaid = iou.amount_paid + request.amount_claimed;
      const newStatus = newAmountPaid >= iou.amount ? "paid" : "partial";

      try {
        const { error } = await supabase
          .from("ious")
          .update({
            amount_paid: newAmountPaid,
            status: newStatus,
          })
          .eq("id", iou.id);

        if (!error) {
          updateIOULocally(prev => ({
            ...prev,
            amount_paid: newAmountPaid,
            status: newStatus,
          }));
        }
      } catch (error) {
        console.error("Error updating IOU:", error);
      }
    }
    return success;
  };

  // Handle rejecting a payment request
  const handleRejectRequest = async (requestId: string, reason?: string) => {
    return await updateRequestStatus(requestId, 'rejected', reason);
  };

  // Generate WhatsApp message for the debtor
  const generateWhatsAppMessage = () => {
    const remaining = iou.amount - iou.amount_paid;
    const dueDateInfo = iou.due_date 
      ? `\n📅 Due Date: ${format(new Date(iou.due_date), "MMMM d, yyyy")}`
      : '';
    
    return `Hi ${debtorName},

This is a reminder for your pending payment.

💰 *Amount Owed:* ${iou.currency} ${iou.amount.toFixed(2)}${iou.description ? `\n📝 *For:* ${iou.description}` : ''}
✅ *Paid:* ${iou.currency} ${iou.amount_paid.toFixed(2)}
⏳ *Remaining:* ${iou.currency} ${remaining.toFixed(2)}${dueDateInfo}

Please settle the amount at your earliest convenience. Thank you! 🙏

---
📱 *Tired of tracking who owes you?*
Download OweLink - your smart money tracker!
Never lose track of debts again. Split bills, send reminders & get paid faster.
🔗 Get OweLink now!`;
  };

  // Open WhatsApp for the debtor
  const handleWhatsAppShare = () => {
    const message = generateWhatsAppMessage();
    // Use the user's country code from their profile, or extract from their phone number
    const userCountryCode = profile?.phone_number?.replace(/[^0-9]/g, '').slice(0, 2);
    const phoneNumber = formatPhoneForWhatsApp(iou.debtor_phone_number, userCountryCode);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEditSubmit = async () => {
    const success = await updateIOU(iou.id, {
      description: editForm.description || undefined,
      amount: parseFloat(editForm.amount),
      due_date: editForm.due_date || undefined,
    });

    if (success) {
      updateIOULocally(prev => ({
        ...prev,
        description: editForm.description || null,
        amount: parseFloat(editForm.amount),
        due_date: editForm.due_date || null,
      }));
      setShowEditDialog(false);
    }
  };

  const handleDelete = async () => {
    const success = await deleteIOU(iou.id);
    if (success) {
      navigate("/ious");
    }
  };

  const handlePayment = async () => {
    if (!paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const newAmountPaid = iou.amount_paid + amount;
    const newStatus = newAmountPaid >= iou.amount ? "paid" : "partial";

    try {
      // Record payment
      await supabase.from("payments").insert({
        reference_type: "iou",
        reference_id: iou.id,
        payer_phone_number: iou.debtor_phone_number,
        payer_id: iou.debtor_user_id,
        amount,
        currency: iou.currency,
      });

      // Update IOU
      const { error } = await supabase
        .from("ious")
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq("id", iou.id);

      if (error) throw error;

      // Update local state
      updateIOULocally(prev => ({
        ...prev,
        amount_paid: newAmountPaid,
        status: newStatus,
      }));

      toast.success("Payment recorded");
      setShowPaymentDialog(false);
      setPaymentAmount("");
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const amountPaid = newStatus === "paid" ? iou.amount : iou.amount_paid;

      const { error } = await supabase
        .from("ious")
        .update({
          status: newStatus,
          amount_paid: amountPaid,
        })
        .eq("id", iou.id);

      if (error) throw error;

      updateIOULocally(prev => ({
        ...prev,
        status: newStatus,
        amount_paid: amountPaid,
      }));

      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const openEditDialog = () => {
    setEditForm({
      description: iou.description || "",
      amount: iou.amount.toString(),
      due_date: iou.due_date ? iou.due_date.split("T")[0] : "",
    });
    setShowEditDialog(true);
  };

  return (
    <AppLayout hideNav>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/ious")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-foreground">IOU Details</h1>
          </div>
          {isCreditor && (
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={openEditDialog}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>

        {/* Debtor Info */}
        <div className="card-elevated p-4">
          <div className="flex items-center gap-4">
            <AvatarCustom name={debtorName} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg text-foreground">{debtorName}</h2>
                {isCreditor ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    <ArrowDownLeft className="h-3 w-3" />
                    owes you
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full">
                    <ArrowUpRight className="h-3 w-3" />
                    you owe
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {iou.debtor_phone_number}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {iou.deleted_at && (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  <Archive className="h-3 w-3" />
                  Archived
                </span>
              )}
              <StatusBadge status={iou.status as any} />
            </div>
          </div>

          {/* WhatsApp button for creditors */}
          {isCreditor && iou.status !== 'paid' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsAppShare}
              className="mt-3 w-full text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Send Reminder via WhatsApp
            </Button>
          )}
        </div>

        {/* Amount Summary */}
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
              <MoneyDisplay amount={iou.amount} currency={iou.currency} size="xl" />
            </div>
            {isCreditor && (
              <Select value={iou.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <MoneyDisplay amount={iou.amount_paid} currency={iou.currency} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <MoneyDisplay amount={remaining} currency={iou.currency} className="text-rose-600" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            {progress.toFixed(0)}% paid
          </p>

          {iou.due_date && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Due {format(new Date(iou.due_date), "MMMM d, yyyy")}
              </span>
            </div>
          )}
        </div>

        {/* Payment Requests Panel - for creditors to manage requests */}
        {isCreditor && requests.length > 0 && (
          <IOUPaymentRequestsPanel
            requests={requests}
            currency={iou.currency}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            getRequesterName={getContactNameBySuffix}
          />
        )}

        {/* Description */}
        {iou.description && (
          <div className="card-elevated p-4">
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-foreground">{iou.description}</p>
          </div>
        )}

        {/* Actions - for creditors to record payment */}
        {isCreditor && iou.status !== "paid" && (
          <Button
            className="w-full"
            onClick={() => {
              setPaymentAmount(remaining.toString());
              setShowPaymentDialog(true);
            }}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        )}

        {/* Request confirmation button - for debtors who haven't fully paid */}
        {isDebtor && iou.status !== "paid" && remaining > 0 && (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setShowPaymentRequestDialog(true)}
          >
            <FileCheck className="h-4 w-4 mr-2" />
            Request Payment Confirmation
          </Button>
        )}

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit IOU</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Recording payment of ${paymentAmount || "0.00"} from {debtorName}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handlePayment}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archive Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive IOU?</AlertDialogTitle>
              <AlertDialogDescription>
                This will archive this IOU. It will be hidden from your view but the debtor can still see it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Payment Request Dialog - for debtors */}
        <IOUPaymentRequestDialog
          open={showPaymentRequestDialog}
          onOpenChange={setShowPaymentRequestDialog}
          iouId={iou.id}
          remainingAmount={remaining}
          currency={iou.currency}
          onSubmit={handlePaymentRequestSubmit}
        />
      </div>
    </AppLayout>
  );
}
