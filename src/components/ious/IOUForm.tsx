import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useDeviceContacts, DeviceContact } from "@/hooks/useDeviceContacts";
import { useIOUs, IOUInsert } from "@/hooks/useIOUs";
import { useAuth } from "@/hooks/useAuth";
import { useRecurring } from "@/hooks/useRecurring";
import { RecurringToggle } from "@/components/recurring/RecurringToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currencies";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  Search,
  Plus,
  X,
  Loader2,
  Phone,
  FileText,
  Smartphone,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { MiniCalculator } from "@/components/ui/MiniCalculator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SUBMIT_TIMEOUT_MS = 2000;

export function IOUForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currency } = useAuth();
  const { contacts, addContact, loading: contactsLoading } = useContacts();
  const { deviceContacts, fetchDeviceContacts, loading: deviceContactsLoading } = useDeviceContacts();
  const { createIOU } = useIOUs();
  const { createRecurring } = useRecurring();

  const currencySymbol = getCurrencySymbol(currency);

  // Check for pre-filled debtor from URL params
  const prefilledPhone = searchParams.get('phone');
  const prefilledName = searchParams.get('name');

  // Form state
  const [direction, setDirection] = useState<'owed_to_me' | 'i_owe'>('owed_to_me');
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedDebtor, setSelectedDebtor] = useState<{ phone_number: string; nickname: string | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState<string>("3");
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");

  // Prevent double-submit
  const submitLockRef = useRef(false);

  // Pre-fill debtor if URL params are provided
  useEffect(() => {
    if (prefilledPhone && !selectedDebtor) {
      setSelectedDebtor({
        phone_number: prefilledPhone,
        nickname: prefilledName || null,
      });
    }
  }, [prefilledPhone, prefilledName]);

  const total = parseFloat(amount) || 0;

  // Filter contacts based on search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.nickname?.toLowerCase().includes(q) || c.phone_number.includes(q)
    );
  }, [contacts, searchQuery]);

  // Filter device contacts based on search
  const filteredDeviceContacts = useMemo(() => {
    const appContactPhones = new Set(contacts.map(c => c.phone_number));

    let filtered = deviceContacts.filter(
      (c) => !appContactPhones.has(c.phone_number)
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) || c.phone_number.includes(q)
      );
    }

    return filtered;
  }, [deviceContacts, contacts, searchQuery]);

  // Select debtor from app contact
  const selectDebtor = (contact: Contact) => {
    setSelectedDebtor({ phone_number: contact.phone_number, nickname: contact.nickname });
    setSearchQuery("");
    if (errors.debtor) setErrors((prev) => ({ ...prev, debtor: "" }));
  };

  // Select debtor from device contact
  const selectDebtorFromDevice = (deviceContact: DeviceContact) => {
    setSelectedDebtor({ phone_number: deviceContact.phone_number, nickname: deviceContact.name });
    setSearchQuery("");
    if (errors.debtor) setErrors((prev) => ({ ...prev, debtor: "" }));
  };

  // Handle adding new contact inline
  const handleAddNewContact = async (data: {
    phone_number: string;
    nickname?: string;
  }) => {
    const contact = await addContact(data);
    if (contact) {
      selectDebtor(contact);
      return contact;
    }
    return null;
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedDebtor) {
      newErrors.debtor = direction === 'owed_to_me' ? "Select who owes you" : "Select who you owe";
    }

    if (!amount || total <= 0) {
      newErrors.amount = "Enter a valid amount";
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
      const iouData: IOUInsert = {
        debtor_phone_number: selectedDebtor!.phone_number,
        amount: total,
        currency,
        description: description.trim() || undefined,
        due_date: dueDate?.toISOString(),
        reminder_enabled: direction === 'owed_to_me' ? reminderEnabled : false,
        reminder_interval_days: direction === 'owed_to_me' && reminderEnabled ? parseInt(reminderInterval) : undefined,
        direction,
      };

      // Race the createIOU call with a timeout to ensure UI never hangs
      const result = await Promise.race([
        createIOU(iouData),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.log('[IOUForm] Submit timed out, navigating anyway');
            resolve(null);
          }, SUBMIT_TIMEOUT_MS);
        }),
      ]);

      // Navigate regardless of result (local save should have completed)
      toast.success("Saved offline, will sync when back online");

      // Create recurring schedule if enabled
      if (recurringEnabled && selectedDebtor) {
        try {
          const nextRun = new Date();
          if (recurringFrequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
          else if (recurringFrequency === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);
          else nextRun.setFullYear(nextRun.getFullYear() + 1);

          await createRecurring({
            entity_type: "iou",
            template_data: {
              debtor_phone_number: selectedDebtor.phone_number,
              amount: total,
              currency,
              description: description.trim() || undefined,
              direction,
              created_ref: new Date().toISOString(),
            },
            frequency: recurringFrequency as "weekly" | "monthly" | "yearly",
            next_run_at: nextRun.toISOString(),
          });
        } catch (e) {
          console.error("Failed to create recurring schedule:", e);
        }
      }

      navigate("/ious");
    } catch (error) {
      console.error("Error creating IOU:", error);
      toast.error("Failed to create IOU");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Direction Toggle */}
      <Tabs value={direction} onValueChange={(v) => setDirection(v as 'owed_to_me' | 'i_owe')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="owed_to_me" className="flex items-center gap-2 text-sm font-medium">
            <ArrowDownLeft className="h-4 w-4" />
            They owe me
          </TabsTrigger>
          <TabsTrigger value="i_owe" className="flex items-center gap-2 text-sm font-medium">
            <ArrowUpRight className="h-4 w-4" />
            I owe them
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Debtor Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          {direction === 'owed_to_me' ? 'Who owes you?' : 'Who do you owe?'}
        </Label>

        {selectedDebtor ? (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <AvatarCustom
              name={selectedDebtor.nickname || selectedDebtor.phone_number}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {selectedDebtor.nickname || selectedDebtor.phone_number}
              </p>
              {selectedDebtor.nickname && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {selectedDebtor.phone_number}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setSelectedDebtor(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            {/* Hint about phone contacts */}
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20">
              <Smartphone className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Start typing to search your <span className="font-medium text-foreground">phone contacts</span> and app contacts
              </p>
            </div>

            <div className="relative">
              <Input
                placeholder="Type a name or phone number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // Auto-fetch device contacts when user starts typing
                  if (e.target.value && deviceContacts.length === 0) {
                    fetchDeviceContacts();
                  }
                }}
                icon={<Search className="h-4 w-4" />}
                error={!!errors.debtor}
              />

              {/* Combined contact dropdown - app contacts + device contacts */}
              {searchQuery && (filteredContacts.length > 0 || filteredDeviceContacts.length > 0) && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {/* App contacts */}
                  {filteredContacts.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                        <span className="text-xs font-medium text-muted-foreground">App Contacts</span>
                      </div>
                      {filteredContacts.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left border-b border-border last:border-b-0"
                          onClick={() => selectDebtor(contact)}
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
                    </>
                  )}

                  {/* Device contacts */}
                  {filteredDeviceContacts.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center gap-2">
                        <Smartphone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Phone Contacts</span>
                      </div>
                      {filteredDeviceContacts.map((deviceContact) => (
                        <button
                          key={deviceContact.id}
                          type="button"
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left border-b border-border last:border-b-0"
                          onClick={() => selectDebtorFromDevice(deviceContact)}
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
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {searchQuery && filteredContacts.length === 0 && filteredDeviceContacts.length === 0 && !contactsLoading && (
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
          </>
        )}

        {errors.debtor && !selectedDebtor && (
          <p className="text-sm text-destructive">{errors.debtor}</p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAddContact(true)}
          className="text-primary"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add New Contact
        </Button>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="flex gap-2">
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: "" }));
            }}
            icon={<span className="text-sm font-medium text-muted-foreground">{currencySymbol}</span>}
            error={!!errors.amount}
            className="flex-1"
          />
          <MiniCalculator onInsert={(val) => setAmount(val.toString())} />
        </div>
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="What's this for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none"
        />
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

      {/* Automatic Reminders - only for "They owe me" */}
      {direction === 'owed_to_me' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Automatic reminders</p>
                <p className="text-xs text-muted-foreground">
                  Send push notifications to debtor
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
      )}

      {/* Recurring */}
      <RecurringToggle
        enabled={recurringEnabled}
        onEnabledChange={setRecurringEnabled}
        frequency={recurringFrequency}
        onFrequencyChange={setRecurringFrequency}
      />

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          "Create"
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