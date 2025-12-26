import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useBillDetail, BillParticipant } from "@/hooks/useBills";
import { useContacts, Contact } from "@/hooks/useContacts";
import { usePaymentRequests } from "@/hooks/usePaymentRequests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Plus,
  DollarSign,
  Check,
  X,
  Users,
  Search,
  User,
  Archive,
  Bell,
  MessageCircle,
  Send,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBills } from "@/hooks/useBills";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";
import { PaymentRequestDialog } from "@/components/bills/PaymentRequestDialog";
import { PaymentRequestsPanel } from "@/components/bills/PaymentRequestsPanel";
import { 
  updateBillParticipantOfflineFirst, 
  createBillParticipantOfflineFirst,
  deleteBillParticipantOfflineFirst,
  createPaymentOfflineFirst,
  updateBillOfflineFirst,
} from "@/lib/offline/offlineDataLayer";
import { useOffline } from "@/hooks/useOffline";
import { sendPushNotification, getPhoneSuffix } from "@/lib/notifications";
import { formatPhoneForWhatsApp } from "@/lib/phoneUtils";

export default function BillDetail() {
  const { user, profile, loading: authLoading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { bill, loading, updateBillLocally } = useBillDetail(id);
  const { updateBill, deleteBill } = useBills();
  const { contacts, addContact } = useContacts();
  const { sync } = useOffline();
  const { requests, createRequest, updateRequestStatus, refetch: refetchRequests } = usePaymentRequests(id);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [showPaymentRequestDialog, setShowPaymentRequestDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<BillParticipant | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    total_amount: "",
    due_date: "",
    reminder_enabled: false,
    reminder_interval_days: "3",
  });
  const [newParticipantPhone, setNewParticipantPhone] = useState("");
  const [newParticipantAmount, setNewParticipantAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter contacts for add participant dialog
  const filteredContacts = useMemo(() => {
    if (!bill) return [];
    const existingPhones = new Set(bill.participants?.map(p => p.phone_number) || []);
    let filtered = contacts.filter(c => !existingPhones.has(c.phone_number));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c => c.nickname?.toLowerCase().includes(q) || c.phone_number.includes(q)
      );
    }

    return filtered;
  }, [contacts, bill?.participants, searchQuery]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-4 animate-fade-in">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!bill) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Bill not found</p>
          <Button variant="link" onClick={() => navigate("/bills")}>
            Go back to bills
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isCreator = bill.creator_id === user.id;
  const totalPaid = bill.participants?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;
  const remaining = bill.total_amount - totalPaid;
  const progress = bill.total_amount > 0 ? (totalPaid / bill.total_amount) * 100 : 0;

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

  // Find current user's participant record (for debtors)
  const userPhoneSuffix = profile?.phone_suffix || (profile?.phone_number ? getPhoneSuffix(profile.phone_number) : null);
  const currentUserParticipant = useMemo(() => {
    if (!userPhoneSuffix || !bill?.participants) return null;
    return bill.participants.find(p => {
      const pSuffix = p.phone_suffix || getPhoneSuffix(p.phone_number);
      return pSuffix === userPhoneSuffix;
    });
  }, [bill?.participants, userPhoneSuffix]);

  // Check if user is a debtor (participant but not creator)
  const isDebtor = !isCreator && !!currentUserParticipant;
  const debtorRemainingAmount = currentUserParticipant 
    ? currentUserParticipant.amount_owed - currentUserParticipant.amount_paid 
    : 0;

  // Pending payment requests count for creators
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  const handleEditSubmit = async () => {
    const success = await updateBill(bill.id, {
      title: editForm.title,
      description: editForm.description || undefined,
      total_amount: parseFloat(editForm.total_amount),
      due_date: editForm.due_date || undefined,
      reminder_enabled: editForm.reminder_enabled,
      reminder_interval_days: editForm.reminder_enabled ? parseInt(editForm.reminder_interval_days) : undefined,
    });

    if (success) {
      updateBillLocally(prev => ({
        ...prev,
        title: editForm.title,
        description: editForm.description || null,
        total_amount: parseFloat(editForm.total_amount),
        due_date: editForm.due_date || null,
        reminder_enabled: editForm.reminder_enabled,
        reminder_interval_days: editForm.reminder_enabled ? parseInt(editForm.reminder_interval_days) : null,
      }));
      setShowEditDialog(false);
    }
  };

  const handleDelete = async () => {
    const success = await deleteBill(bill.id, bill);
    if (success) {
      navigate("/bills");
    }
  };

  const handlePayment = async () => {
    if (!selectedParticipant || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const newAmountPaid = selectedParticipant.amount_paid + amount;
    const newStatus = newAmountPaid >= selectedParticipant.amount_owed ? "paid" : "partial";

    try {
      // Record payment offline-first
      await createPaymentOfflineFirst({
        reference_type: "bill",
        reference_id: bill.id,
        payer_phone_number: selectedParticipant.phone_number,
        payer_id: selectedParticipant.user_id,
        amount,
        currency: bill.currency,
      });

      // Update participant offline-first
      await updateBillParticipantOfflineFirst(selectedParticipant.id, {
        amount_paid: newAmountPaid,
        status: newStatus,
      });

      // Update local state immediately
      const updatedParticipants = bill.participants?.map(p =>
        p.id === selectedParticipant.id
          ? { ...p, amount_paid: newAmountPaid, status: newStatus }
          : p
      );
      
      // Check if all participants are now paid
      const allPaid = updatedParticipants?.every(p => p.amount_paid >= p.amount_owed);

      // Bill status: paid if all paid, pending otherwise
      const newBillStatus = allPaid ? "paid" : "pending";
      const statusChanged = bill.status !== newBillStatus;

      updateBillLocally(prev => ({
        ...prev,
        participants: updatedParticipants,
        status: newBillStatus,
      }));

      // Update bill status if changed
      if (statusChanged) {
        await updateBillOfflineFirst(bill.id, { status: newBillStatus });
      }

      // Send push notification to participant
      const phoneSuffix = getPhoneSuffix(selectedParticipant.phone_number);
      if (phoneSuffix && navigator.onLine) {
        sendPushNotification({
          phoneSuffixes: [phoneSuffix],
          title: "Payment Recorded",
          body: `Your payment of ${bill.currency} ${amount.toFixed(2)} for "${bill.title}" has been recorded.`,
          data: { type: "bill", id: bill.id },
        });
      }

      // Notify bill creator if payer is not the creator
      if (selectedParticipant.user_id !== bill.creator_id && bill.creator?.phone_number && navigator.onLine) {
        const creatorSuffix = getPhoneSuffix(bill.creator.phone_number);
        if (creatorSuffix) {
          sendPushNotification({
            phoneSuffixes: [creatorSuffix],
            title: "Payment Received",
            body: `${getContactName(selectedParticipant.phone_number)} paid ${bill.currency} ${amount.toFixed(2)} for "${bill.title}"`,
            data: { type: "bill", id: bill.id },
          });
        }
      }

      toast.success("Payment recorded");
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setSelectedParticipant(null);
      
      // Trigger sync in background
      sync();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleStatusChange = async (participant: BillParticipant, newStatus: string) => {
    try {
      const amountPaid = newStatus === "paid" ? participant.amount_owed : participant.amount_paid;

      // Update offline-first
      await updateBillParticipantOfflineFirst(participant.id, {
        status: newStatus,
        amount_paid: amountPaid,
      });

      // Check if all participants will be paid after this update
      const updatedParticipants = bill.participants?.map(p =>
        p.id === participant.id
          ? { ...p, status: newStatus, amount_paid: amountPaid }
          : p
      );
      const allPaid = updatedParticipants?.every(p => 
        p.status === 'paid' || p.amount_paid >= p.amount_owed
      );

      // Bill status: paid if all paid, pending otherwise
      const newBillStatus = allPaid ? "paid" : "pending";
      const statusChanged = bill.status !== newBillStatus;

      // Update UI immediately
      updateBillLocally(prev => ({
        ...prev,
        participants: updatedParticipants,
        status: newBillStatus,
      }));

      // Update bill status if changed
      if (statusChanged) {
        await updateBillOfflineFirst(bill.id, { status: newBillStatus });
      }

      // Send push notification to participant
      const phoneSuffix = getPhoneSuffix(participant.phone_number);
      if (phoneSuffix && navigator.onLine) {
        sendPushNotification({
          phoneSuffixes: [phoneSuffix],
          title: "Status Updated",
          body: `Your status for "${bill.title}" has been updated to ${newStatus}.`,
          data: { type: "bill", id: bill.id },
        });
      }

      toast.success("Status updated");
      sync(); // Trigger sync in background
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleSendReminder = async (participant: BillParticipant) => {
    const phoneSuffix = getPhoneSuffix(participant.phone_number);
    if (!phoneSuffix) {
      toast.error("Invalid phone number");
      return;
    }

    const remaining = participant.amount_owed - participant.amount_paid;
    const dueInfo = bill.due_date 
      ? ` Due: ${format(new Date(bill.due_date), "MMM d, yyyy")}`
      : '';

    try {
      await sendPushNotification({
        phoneSuffixes: [phoneSuffix],
        title: `Payment Reminder: ${bill.title}`,
        body: `You owe ${bill.currency} ${remaining.toFixed(2)}.${dueInfo}`,
        data: { type: "bill", id: bill.id },
      });
      toast.success(`Reminder sent to ${getContactName(participant.phone_number)}`);
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error("Failed to send reminder");
    }
  };

  const selectContactForParticipant = (contact: Contact) => {
    setNewParticipantPhone(contact.phone_number);
    setSearchQuery("");
  };

  const handleAddParticipant = async () => {
    if (!newParticipantPhone || !newParticipantAmount) return;

    const amount = parseFloat(newParticipantAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      // Create participant offline-first
      const newParticipant = await createBillParticipantOfflineFirst(bill.id, {
        phone_number: newParticipantPhone,
        amount_owed: amount,
      });

      // Update bill total offline-first
      const newTotal = bill.total_amount + amount;
      
      // If bill was paid, revert to pending since we added a new unpaid participant
      const newStatus = bill.status === 'paid' ? 'pending' : bill.status;
      await updateBillOfflineFirst(bill.id, { 
        total_amount: newTotal,
        status: newStatus,
      });

      // Update UI immediately
      updateBillLocally(prev => ({
        ...prev,
        total_amount: newTotal,
        status: newStatus,
        participants: [...(prev.participants || []), newParticipant as any],
      }));

      toast.success("Participant added");
      setShowAddParticipantDialog(false);
      setNewParticipantPhone("");
      setNewParticipantAmount("");
      setSearchQuery("");
      
      sync(); // Trigger sync in background
    } catch (error) {
      console.error("Error adding participant:", error);
      toast.error("Failed to add participant");
    }
  };

  const handleRemoveParticipant = async (participant: BillParticipant) => {
    try {
      // Delete offline-first
      await deleteBillParticipantOfflineFirst(participant.id);

      // Update UI immediately
      updateBillLocally(prev => ({
        ...prev,
        participants: prev.participants?.filter(p => p.id !== participant.id),
      }));

      toast.success("Participant removed");
      sync(); // Trigger sync in background
    } catch (error) {
      console.error("Error removing participant:", error);
      toast.error("Failed to remove participant");
    }
  };

  const openEditDialog = () => {
    setEditForm({
      title: bill.title,
      description: bill.description || "",
      total_amount: bill.total_amount.toString(),
      due_date: bill.due_date ? bill.due_date.split("T")[0] : "",
      reminder_enabled: bill.reminder_enabled || false,
      reminder_interval_days: bill.reminder_interval_days?.toString() || "3",
    });
    setShowEditDialog(true);
  };

  const handleAddNewContact = async (data: { phone_number: string; nickname?: string }) => {
    const contact = await addContact(data);
    if (contact) {
      setNewParticipantPhone(contact.phone_number);
      setShowAddContactDialog(false);
      return contact;
    }
    return null;
  };

  // Generate WhatsApp message for a participant
  const generateWhatsAppMessage = (participant: BillParticipant) => {
    const remainingAmount = participant.amount_owed - participant.amount_paid;
    const contactName = getContactName(participant.phone_number);
    const dueDateInfo = bill.due_date 
      ? `\n📅 Due Date: ${format(new Date(bill.due_date), "MMMM d, yyyy")}`
      : '';
    
    return `Hi ${contactName},

This is a reminder for your pending payment.

📋 *Bill:* ${bill.title}${bill.description ? `\n📝 *Description:* ${bill.description}` : ''}
💰 *Your Share:* ${bill.currency} ${participant.amount_owed.toFixed(2)}
✅ *Paid:* ${bill.currency} ${participant.amount_paid.toFixed(2)}
⏳ *Remaining:* ${bill.currency} ${remainingAmount.toFixed(2)}${dueDateInfo}

Please settle the amount at your earliest convenience. Thank you! 🙏

---
📱 *Tired of tracking who owes you?*
Download OweLink - your smart money tracker!
Never lose track of debts again. Split bills, send reminders & get paid faster.
🔗 Get OweLink now!`;
  };

  // Open WhatsApp for a single participant
  const handleWhatsAppShare = (participant: BillParticipant) => {
    const message = generateWhatsAppMessage(participant);
    // Use the user's country code from their profile
    const userCountryCode = profile?.phone_number?.replace(/[^0-9]/g, '').slice(0, 2);
    const phoneNumber = formatPhoneForWhatsApp(participant.phone_number, userCountryCode);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Get unpaid participants
  const unpaidParticipants = bill.participants?.filter(p => p.status !== 'paid' && p.amount_paid < p.amount_owed) || [];

  // Handle payment request submission from debtor
  const handlePaymentRequestSubmit = async (data: { amount_claimed: number; receipt_url?: string; message?: string }) => {
    if (!currentUserParticipant) return false;
    return await createRequest({
      bill_id: bill.id,
      participant_id: currentUserParticipant.id,
      amount_claimed: data.amount_claimed,
      receipt_url: data.receipt_url,
      message: data.message,
    });
  };

  // Handle payment request approval - also updates participant status
  const handleApproveRequest = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return false;

    const success = await updateRequestStatus(requestId, 'approved');
    if (success) {
      // Find participant and update their payment status
      const participant = bill.participants?.find(p => p.id === request.participant_id);
      if (participant) {
        const newAmountPaid = participant.amount_paid + request.amount_claimed;
        const newStatus = newAmountPaid >= participant.amount_owed ? 'paid' : 'partial';
        await handleStatusChange(participant, newStatus);
      }
    }
    return success;
  };

  const handleRejectRequest = async (requestId: string, reason?: string) => {
    return await updateRequestStatus(requestId, 'rejected', reason);
  };

  return (
    <AppLayout hideNav>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/bills")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-foreground">{bill.title}</h1>
            {bill.description && (
              <p className="text-sm text-muted-foreground">{bill.description}</p>
            )}
          </div>
          {isCreator && (
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

        {/* Amount Summary */}
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
              <MoneyDisplay amount={bill.total_amount} currency={bill.currency} size="xl" />
            </div>
            <div className="flex items-center gap-2">
              {bill.deleted_at && (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  <Archive className="h-3 w-3" />
                  Archived
                </span>
              )}
              <StatusBadge status={bill.status as any} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Collected</p>
              <MoneyDisplay amount={totalPaid} currency={bill.currency} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <MoneyDisplay amount={remaining} currency={bill.currency} className="text-rose-600" />
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
            {progress.toFixed(0)}% collected
          </p>

          {bill.due_date && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Due {format(new Date(bill.due_date), "MMMM d, yyyy")}
              </span>
            </div>
          )}

          {/* Show creator info for participants (non-creators) */}
          {!isCreator && bill.creator && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Created by <span className="font-medium text-foreground">{bill.creator.username}</span>
              </span>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants ({bill.participants?.length || 0})
            </h2>
            <div className="flex gap-2">
              {isCreator && (
                <Button size="sm" variant="outline" onClick={() => setShowAddParticipantDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {bill.participants?.map((participant) => (
              <div key={participant.id} className="card-elevated p-4">
                <div className="flex items-center gap-3">
                  <AvatarCustom name={getContactName(participant.phone_number)} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {getContactName(participant.phone_number)}
                    </p>
                    <p className="text-xs text-muted-foreground">{participant.phone_number}</p>
                  </div>
                  {isCreator && (
                    <Select
                      value={participant.status}
                      onValueChange={(value) => handleStatusChange(participant, value)}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
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

                <div className="mt-3 space-y-3">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining</p>
                      <MoneyDisplay amount={participant.amount_owed - participant.amount_paid} currency={bill.currency} size="sm" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <MoneyDisplay
                        amount={participant.amount_paid}
                        currency={bill.currency}
                        size="sm"
                        className={participant.amount_paid >= participant.amount_owed ? "text-emerald-600" : ""}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {participant.status !== "paid" && participant.amount_paid < participant.amount_owed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleWhatsAppShare(participant)}
                        title="Send via WhatsApp"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {isCreator && participant.status !== "paid" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSendReminder(participant)}
                          title="Send Push Notification"
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedParticipant(participant);
                            setPaymentAmount((participant.amount_owed - participant.amount_paid).toString());
                            setShowPaymentDialog(true);
                          }}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Pay
                        </Button>
                      </>
                    )}
                    {isCreator && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveParticipant(participant)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Individual progress */}
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min((participant.amount_paid / participant.amount_owed) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debtor: Request Status Change Button */}
        {isDebtor && currentUserParticipant && currentUserParticipant.status !== 'paid' && debtorRemainingAmount > 0 && (
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Already Paid?</p>
                <p className="text-sm text-muted-foreground">
                  Request the bill creator to confirm your payment
                </p>
              </div>
              <Button
                onClick={() => setShowPaymentRequestDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Request Confirmation
              </Button>
            </div>
          </div>
        )}

        {/* Creator: Payment Requests Panel */}
        {isCreator && requests.length > 0 && (
          <PaymentRequestsPanel
            requests={requests}
            currency={bill.currency}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            getContactName={getContactNameBySuffix}
          />
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Total Amount</label>
              <Input
                type="number"
                value={editForm.total_amount}
                onChange={(e) => setEditForm(prev => ({ ...prev, total_amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
            
            {/* Reminder Settings */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <Label className="text-sm font-medium">Automatic Reminders</Label>
                </div>
                <Switch
                  checked={editForm.reminder_enabled}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, reminder_enabled: checked }))}
                />
              </div>
              
              {editForm.reminder_enabled && (
                <div className="pl-6">
                  <Label className="text-sm text-muted-foreground">Send reminder every:</Label>
                  <Select 
                    value={editForm.reminder_interval_days} 
                    onValueChange={(value) => setEditForm(prev => ({ ...prev, reminder_interval_days: value }))}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every day</SelectItem>
                      <SelectItem value="2">Every 2 days</SelectItem>
                      <SelectItem value="3">Every 3 days</SelectItem>
                      <SelectItem value="5">Every 5 days</SelectItem>
                      <SelectItem value="7">Every week</SelectItem>
                      <SelectItem value="14">Every 2 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit}>Save Changes</Button>
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
            <p className="text-sm text-muted-foreground">
              Recording payment for {selectedParticipant && getContactName(selectedParticipant.phone_number)}
            </p>
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
              />
              {selectedParticipant && (
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining: {bill.currency} {(selectedParticipant.amount_owed - selectedParticipant.amount_paid).toFixed(2)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={handlePayment}>
              <Check className="h-4 w-4 mr-1" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Participant Dialog */}
      <Dialog open={showAddParticipantDialog} onOpenChange={setShowAddParticipantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search Contacts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Search Contacts</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddContactDialog(true)}
                  className="text-primary"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New Contact
                </Button>
              </div>
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  icon={<Search className="h-4 w-4" />}
                />

                {/* Contact dropdown */}
                {searchQuery && filteredContacts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left"
                        onClick={() => selectContactForParticipant(contact)}
                      >
                        <AvatarCustom
                          name={contact.nickname || contact.phone_number}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {contact.nickname || contact.phone_number}
                          </p>
                          {contact.nickname && (
                            <p className="text-xs text-muted-foreground truncate">
                              {contact.phone_number}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery && filteredContacts.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg p-3">
                    <p className="text-sm text-muted-foreground text-center mb-2">
                      No contacts found
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAddContactDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add "{searchQuery}" as new contact
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={newParticipantPhone}
                onChange={(e) => setNewParticipantPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Amount Owed</label>
              <Input
                type="number"
                value={newParticipantAmount}
                onChange={(e) => setNewParticipantAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
            <Button onClick={handleAddParticipant}>
              <Plus className="h-4 w-4 mr-1" />
              Add Participant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddContactDialog}
        onOpenChange={setShowAddContactDialog}
        onAdd={handleAddNewContact}
        initialPhone={searchQuery.replace(/\D/g, "")}
      />

      {/* Archive Confirmation */}
      {(() => {
        const unpaidParticipants = bill.participants?.filter(p => p.status !== "paid") || [];
        const canArchive = unpaidParticipants.length === 0;
        
        return (
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive Bill</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    {canArchive ? (
                      <p>Are you sure you want to archive "{bill.title}"? It will be hidden from your view but participants can still see it.</p>
                    ) : (
                      <>
                        <p className="text-destructive font-medium">
                          Cannot archive this bill yet. The following participants haven't paid:
                        </p>
                        <ul className="space-y-1 text-sm">
                          {unpaidParticipants.map(p => (
                            <li key={p.id} className="flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                              <span>{getContactName(p.phone_number)}</span>
                              <span className="text-muted-foreground">
                                ({bill.currency} {(p.amount_owed - p.amount_paid).toFixed(2)} remaining)
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                          To archive this bill, go back and mark each participant as "Paid" by recording their payments or updating their status.
                        </p>
                      </>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                {canArchive && (
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Archive
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Payment Request Dialog for Debtors */}
      {currentUserParticipant && (
        <PaymentRequestDialog
          open={showPaymentRequestDialog}
          onOpenChange={setShowPaymentRequestDialog}
          billId={bill.id}
          participantId={currentUserParticipant.id}
          remainingAmount={debtorRemainingAmount}
          currency={bill.currency}
          onSubmit={handlePaymentRequestSubmit}
        />
      )}
    </AppLayout>
  );
}
