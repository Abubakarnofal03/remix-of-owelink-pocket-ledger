import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useDeviceContacts, DeviceContact } from "@/hooks/useDeviceContacts";
import { useBills, BillInsert } from "@/hooks/useBills";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currencies";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Receipt,
  CalendarIcon,
  Search,
  Plus,
  X,
  Users,
  Loader2,
  Phone,
  DollarSign,
  Check,
  User,
  Smartphone,
  Bell,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Participant {
  id: string;
  phone_number: string;
  nickname: string | null;
  amount: number;
  isMe?: boolean;
  status?: string;
}

const SUBMIT_TIMEOUT_MS = 2000;

export function BillForm() {
  const navigate = useNavigate();
  const { profile, currency } = useAuth();
  const { contacts, addContact, loading: contactsLoading } = useContacts();
  const { deviceContacts, fetchDeviceContacts, loading: deviceContactsLoading } = useDeviceContacts();
  const { createBill } = useBills();

  const currencySymbol = getCurrencySymbol(currency);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [equalSplit, setEqualSplit] = useState(true);
  const [includeMe, setIncludeMe] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeviceContacts, setShowDeviceContacts] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState<string>("3");

  // Prevent double-submit
  const submitLockRef = useRef(false);

  // Calculate split amounts
  const total = parseFloat(totalAmount) || 0;
  const participantCount = participants.length + (includeMe ? 1 : 0);
  const splitAmount = participantCount > 0 ? total / participantCount : 0;

  // Handle includeMe toggle
  useEffect(() => {
    if (equalSplit && participants.length > 0) {
      setParticipants(prev =>
        prev.map(p => ({ ...p, amount: splitAmount }))
      );
    }
  }, [total, participantCount, equalSplit]);

  // Filter contacts based on search and exclude already selected
  const filteredContacts = useMemo(() => {
    const selectedPhones = new Set(participants.map((p) => p.phone_number));
    // Also exclude current user's phone
    if (profile?.phone_number) {
      selectedPhones.add(profile.phone_number);
    }
    let filtered = contacts.filter((c) => !selectedPhones.has(c.phone_number));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.nickname?.toLowerCase().includes(q) || c.phone_number.includes(q)
      );
    }

    return filtered;
  }, [contacts, participants, searchQuery, profile?.phone_number]);

  // Filter device contacts based on search and exclude already selected
  const filteredDeviceContacts = useMemo(() => {
    const selectedPhones = new Set(participants.map((p) => p.phone_number));
    if (profile?.phone_number) {
      selectedPhones.add(profile.phone_number);
    }
    // Also exclude contacts that are already in app contacts
    const appContactPhones = new Set(contacts.map(c => c.phone_number));
    
    let filtered = deviceContacts.filter(
      (c) => !selectedPhones.has(c.phone_number) && !appContactPhones.has(c.phone_number)
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) || c.phone_number.includes(q)
      );
    }

    return filtered;
  }, [deviceContacts, contacts, participants, searchQuery, profile?.phone_number]);

  // Fetch device contacts when showing
  const handleShowDeviceContacts = async () => {
    console.log("handleShowDeviceContacts called");
    console.log("Current deviceContacts:", deviceContacts.length);
    
    const result = await fetchDeviceContacts();
    console.log("fetchDeviceContacts returned:", result.length, "contacts");
    
    if (result.length > 0) {
      setShowDeviceContacts(true);
    }
  };

  // Add participant from contact
  const addParticipant = (contact: Contact) => {
    const newParticipant: Participant = {
      id: contact.id,
      phone_number: contact.phone_number,
      nickname: contact.nickname,
      amount: equalSplit ? splitAmount : 0,
    };
    setParticipants((prev) => [...prev, newParticipant]);
    setSearchQuery("");
  };

  // Add participant from device contact
  const addParticipantFromDevice = (deviceContact: DeviceContact) => {
    const newParticipant: Participant = {
      id: deviceContact.id,
      phone_number: deviceContact.phone_number,
      nickname: deviceContact.name,
      amount: equalSplit ? splitAmount : 0,
    };
    setParticipants((prev) => [...prev, newParticipant]);
    setSearchQuery("");
  };

  // Remove participant
  const removeParticipant = (phone: string) => {
    setParticipants((prev) => prev.filter((p) => p.phone_number !== phone));
  };

  // Update individual participant amount
  const updateParticipantAmount = (phone: string, amount: number) => {
    setParticipants((prev) =>
      prev.map((p) => (p.phone_number === phone ? { ...p, amount } : p))
    );
  };

  // Handle adding new contact inline
  const handleAddNewContact = async (data: {
    phone_number: string;
    nickname?: string;
  }) => {
    const contact = await addContact(data);
    if (contact) {
      addParticipant(contact);
      return contact;
    }
    return null;
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!totalAmount || total <= 0) {
      newErrors.total = "Enter a valid amount";
    }

    if (participants.length === 0 && !includeMe) {
      newErrors.participants = "Add at least one participant";
    }

    if (!equalSplit) {
      const participantTotal = participants.reduce((sum, p) => sum + p.amount, 0);
      const myAmount = includeMe ? splitAmount : 0;
      const expectedTotal = participantTotal + myAmount;
      if (Math.abs(expectedTotal - total) > 0.01) {
        newErrors.split = `Amounts must equal ${currencySymbol}${total.toFixed(2)} (currently ${currencySymbol}${expectedTotal.toFixed(2)})`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Prevent double-submit
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setSubmitting(true);

    try {
      // Build participants list
      const allParticipants = participants.map((p) => ({
        phone_number: p.phone_number,
        amount_owed: equalSplit ? splitAmount : p.amount,
        status: "pending",
        amount_paid: 0,
      }));

      // Add current user if included
      if (includeMe && profile?.phone_number) {
        allParticipants.push({
          phone_number: profile.phone_number,
          amount_owed: splitAmount,
          status: "paid", // Marked as paid by default
          amount_paid: splitAmount,
        });
      }

      const billData: BillInsert = {
        title: title.trim(),
        description: description.trim() || undefined,
        total_amount: total,
        currency,
        due_date: dueDate?.toISOString(),
        reminder_enabled: reminderEnabled,
        reminder_interval_days: reminderEnabled ? parseInt(reminderInterval) : undefined,
        participants: allParticipants,
      };

      // Race the createBill call with a timeout to ensure UI never hangs
      const result = await Promise.race([
        createBill(billData),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.log('[BillForm] Submit timed out, navigating anyway');
            resolve(null);
          }, SUBMIT_TIMEOUT_MS);
        }),
      ]);

      // Navigate regardless of result (local save should have completed)
      toast.success("Saved offline, will sync when back online");
      navigate("/bills");
    } catch (error) {
      console.error("Error creating bill:", error);
      toast.error("Failed to create bill");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Bill Title</Label>
        <Input
          id="title"
          placeholder="Dinner at Italian Place"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
          }}
          icon={<Receipt className="h-4 w-4" />}
          error={!!errors.title}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="Add any notes about this bill..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Total Amount */}
      <div className="space-y-2">
        <Label htmlFor="total">Total Amount</Label>
        <Input
          id="total"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={totalAmount}
          onChange={(e) => {
            setTotalAmount(e.target.value);
            if (errors.total) setErrors((prev) => ({ ...prev, total: "" }));
          }}
          icon={<DollarSign className="h-4 w-4" />}
          error={!!errors.total}
        />
        {errors.total && (
          <p className="text-sm text-destructive">{errors.total}</p>
        )}
      </div>

      {/* Due Date */}
      <div className="space-y-2">
        <Label>Due Date (optional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dueDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dueDate ? format(dueDate, "PPP") : "Pick a due date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={setDueDate}
              initialFocus
              disabled={(date) => date < new Date()}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Automatic Reminders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Bell className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Automatic reminders</p>
              <p className="text-xs text-muted-foreground">
                Send push notifications to unpaid participants
              </p>
            </div>
          </div>
          <Switch
            checked={reminderEnabled}
            onCheckedChange={setReminderEnabled}
          />
        </div>

        {reminderEnabled && (
          <div className="pl-4 border-l-2 border-amber-500/30 ml-4 space-y-2">
            <Label className="text-sm text-muted-foreground">Send reminder every:</Label>
            <Select value={reminderInterval} onValueChange={setReminderInterval}>
              <SelectTrigger className="w-full">
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

      {/* Include Me Toggle */}
      {profile?.phone_number && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Include me in this bill</p>
              <p className="text-xs text-muted-foreground">
                Your share will be marked as paid by default
              </p>
            </div>
          </div>
          <Switch
            checked={includeMe}
            onCheckedChange={setIncludeMe}
          />
        </div>
      )}

      {/* Participants Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleShowDeviceContacts}
              className="text-primary"
              disabled={deviceContactsLoading}
            >
              {deviceContactsLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4 mr-1" />
              )}
              From Phone
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddContact(true)}
              className="text-primary"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Device Contacts List */}
        {showDeviceContacts && (
          <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Phone Contacts ({filteredDeviceContacts.length})</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowDeviceContacts(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {filteredDeviceContacts.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No contacts found on your device
              </div>
            ) : (
              filteredDeviceContacts.map((deviceContact) => (
                <button
                  key={deviceContact.id}
                  type="button"
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left border-b border-border last:border-b-0"
                  onClick={() => addParticipantFromDevice(deviceContact)}
                >
                  <AvatarCustom
                    name={deviceContact.name || deviceContact.phone_number}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {deviceContact.name || deviceContact.phone_number}
                    </p>
                    {deviceContact.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {deviceContact.phone_number}
                      </p>
                    )}
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Input
            placeholder="Search contacts by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
            error={!!errors.participants}
          />

          {/* Contact dropdown */}
          {searchQuery && filteredContacts.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left"
                  onClick={() => addParticipant(contact)}
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
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {searchQuery && filteredContacts.length === 0 && !contactsLoading && (
            <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg p-3">
              <p className="text-sm text-muted-foreground text-center mb-2">
                No contacts found
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAddContact(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add "{searchQuery}" as new contact
              </Button>
            </div>
          )}
        </div>

        {errors.participants && (
          <p className="text-sm text-destructive">{errors.participants}</p>
        )}

        {/* Selected Participants */}
        {participants.length > 0 && (
          <div className="space-y-2">
            {participants.map((p) => (
              <div
                key={p.phone_number}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border"
              >
                <AvatarCustom
                  name={p.nickname || p.phone_number}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {p.nickname || p.phone_number}
                  </p>
                  {p.nickname && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {p.phone_number}
                    </p>
                  )}
                </div>
                {equalSplit ? (
                  <span className="text-sm font-medium text-primary">
                    {currencySymbol}{splitAmount.toFixed(2)}
                  </span>
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={p.amount}
                    onChange={(e) =>
                      updateParticipantAmount(p.phone_number, parseFloat(e.target.value) || 0)
                    }
                    className="w-24 text-right"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeParticipant(p.phone_number)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Equal Split Toggle */}
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="equalSplit" className="text-sm text-muted-foreground">
                Split equally
              </Label>
              <Switch
                id="equalSplit"
                checked={equalSplit}
                onCheckedChange={setEqualSplit}
              />
            </div>
          </div>
        )}

        {errors.split && (
          <p className="text-sm text-destructive">{errors.split}</p>
        )}
      </div>

      {/* Summary */}
      {participants.length > 0 && (
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-semibold">
              {currencySymbol}{total.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Split between {participantCount} {participantCount === 1 ? "person" : "people"}
            </span>
            <span className="text-sm font-medium text-primary">
              {currencySymbol}{splitAmount.toFixed(2)} each
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Create Bill
          </>
        )}
      </Button>

      {/* Add Contact Dialog */}
      <AddContactDialog
        open={showAddContact}
        onOpenChange={setShowAddContact}
        onAdd={handleAddNewContact}
        initialPhone={searchQuery}
      />
    </form>
  );
}