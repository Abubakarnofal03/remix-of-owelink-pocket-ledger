import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useBillDetail, BillParticipant } from "@/hooks/useBills";
import { useContacts, Contact } from "@/hooks/useContacts";
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBills } from "@/hooks/useBills";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";

export default function BillDetail() {
  const { user, loading: authLoading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { bill, loading, updateBillLocally } = useBillDetail(id);
  const { updateBill, deleteBill } = useBills();
  const { contacts, addContact } = useContacts();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [showAddContactDialog, setShowAddContactDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<BillParticipant | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    total_amount: "",
    due_date: "",
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

  const handleEditSubmit = async () => {
    const success = await updateBill(bill.id, {
      title: editForm.title,
      description: editForm.description || undefined,
      total_amount: parseFloat(editForm.total_amount),
      due_date: editForm.due_date || undefined,
    });

    if (success) {
      updateBillLocally(prev => ({
        ...prev,
        title: editForm.title,
        description: editForm.description || null,
        total_amount: parseFloat(editForm.total_amount),
        due_date: editForm.due_date || null,
      }));
      setShowEditDialog(false);
    }
  };

  const handleDelete = async () => {
    const success = await deleteBill(bill.id);
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

    // Calculate the remaining amount owed
    const currentRemaining = selectedParticipant.amount_owed - selectedParticipant.amount_paid;
    if (amount > currentRemaining) {
      toast.error(`Payment cannot exceed remaining amount (${currentRemaining.toFixed(2)})`);
      return;
    }

    const newAmountPaid = selectedParticipant.amount_paid + amount;
    const newStatus = newAmountPaid >= selectedParticipant.amount_owed ? "paid" : "partial";

    try {
      // Record payment
      await supabase.from("payments").insert({
        reference_type: "bill",
        reference_id: bill.id,
        payer_phone_number: selectedParticipant.phone_number,
        payer_id: selectedParticipant.user_id,
        amount,
        currency: bill.currency,
      });

      // Update participant - amount_paid tracks total paid, amount_owed stays as original obligation
      const { error } = await supabase
        .from("bill_participants")
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq("id", selectedParticipant.id);

      if (error) throw error;

      // Update local state
      updateBillLocally(prev => {
        const updatedParticipants = prev.participants?.map(p =>
          p.id === selectedParticipant.id
            ? { ...p, amount_paid: newAmountPaid, status: newStatus }
            : p
        );

        // Check if all participants paid
        const allPaid = updatedParticipants?.every(p => p.amount_paid >= p.amount_owed);
        
        return {
          ...prev,
          participants: updatedParticipants,
          status: allPaid ? "completed" : prev.status,
        };
      });

      if (bill.participants?.every(p =>
        p.id === selectedParticipant.id
          ? newAmountPaid >= p.amount_owed
          : p.amount_paid >= p.amount_owed
      )) {
        await supabase.from("bills").update({ status: "completed" }).eq("id", bill.id);
      }

      toast.success("Payment recorded");
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setSelectedParticipant(null);
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleStatusChange = async (participant: BillParticipant, newStatus: string) => {
    try {
      const amountPaid = newStatus === "paid" ? participant.amount_owed : participant.amount_paid;

      const { error } = await supabase
        .from("bill_participants")
        .update({
          status: newStatus,
          amount_paid: amountPaid,
        })
        .eq("id", participant.id);

      if (error) throw error;

      updateBillLocally(prev => ({
        ...prev,
        participants: prev.participants?.map(p =>
          p.id === participant.id
            ? { ...p, status: newStatus, amount_paid: amountPaid }
            : p
        ),
      }));

      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
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
      // Insert participant
      const { data, error } = await supabase
        .from("bill_participants")
        .insert({
          bill_id: bill.id,
          phone_number: newParticipantPhone,
          amount_owed: amount,
          amount_paid: 0,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Update bill total amount
      const newTotal = bill.total_amount + amount;
      const { error: updateError } = await supabase
        .from("bills")
        .update({ total_amount: newTotal })
        .eq("id", bill.id);

      if (updateError) throw updateError;

      // Update local state with new participant and new total
      updateBillLocally(prev => ({
        ...prev,
        total_amount: newTotal,
        participants: [...(prev.participants || []), data],
      }));

      toast.success("Participant added");
      setShowAddParticipantDialog(false);
      setNewParticipantPhone("");
      setNewParticipantAmount("");
      setSearchQuery("");
    } catch (error) {
      console.error("Error adding participant:", error);
      toast.error("Failed to add participant");
    }
  };

  const handleRemoveParticipant = async (participant: BillParticipant) => {
    try {
      const { error } = await supabase
        .from("bill_participants")
        .delete()
        .eq("id", participant.id);

      if (error) throw error;

      updateBillLocally(prev => ({
        ...prev,
        participants: prev.participants?.filter(p => p.id !== participant.id),
      }));

      toast.success("Participant removed");
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
            <StatusBadge status={bill.status as any} />
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
            {isCreator && (
              <Button size="sm" variant="outline" onClick={() => setShowAddParticipantDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
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

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining</p>
                      <MoneyDisplay 
                        amount={Math.max(0, participant.amount_owed - participant.amount_paid)} 
                        currency={bill.currency} 
                        size="sm"
                        className={participant.amount_paid >= participant.amount_owed ? "text-emerald-600" : "text-rose-600"} 
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <MoneyDisplay
                        amount={participant.amount_paid}
                        currency={bill.currency}
                        size="sm"
                        className={participant.amount_paid > 0 ? "text-emerald-600" : ""}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <MoneyDisplay amount={participant.amount_owed} currency={bill.currency} size="sm" className="text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isCreator && participant.status !== "paid" && (
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

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{bill.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
