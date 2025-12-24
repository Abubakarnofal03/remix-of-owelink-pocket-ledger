import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useDeviceContacts, DeviceContact } from "@/hooks/useDeviceContacts";
import { useIOUs, IOUInsert } from "@/hooks/useIOUs";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddContactDialog } from "@/components/contacts/AddContactDialog";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currencies";
import { format } from "date-fns";
import {
  CalendarIcon,
  Search,
  Plus,
  X,
  Loader2,
  Phone,
  DollarSign,
  FileText,
  Smartphone,
} from "lucide-react";

export function IOUForm() {
  const navigate = useNavigate();
  const { currency } = useAuth();
  const { contacts, addContact, loading: contactsLoading } = useContacts();
  const { deviceContacts, fetchDeviceContacts, loading: deviceContactsLoading } = useDeviceContacts();
  const { createIOU } = useIOUs();

  const currencySymbol = getCurrencySymbol(currency);

  // Form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedDebtor, setSelectedDebtor] = useState<{ phone_number: string; nickname: string | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeviceContacts, setShowDeviceContacts] = useState(false);

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

  // Fetch device contacts when showing
  const handleShowDeviceContacts = async () => {
    if (deviceContacts.length === 0) {
      await fetchDeviceContacts();
    }
    setShowDeviceContacts(true);
  };

  // Select debtor from app contact
  const selectDebtor = (contact: Contact) => {
    setSelectedDebtor({ phone_number: contact.phone_number, nickname: contact.nickname });
    setSearchQuery("");
    setShowDeviceContacts(false);
    if (errors.debtor) setErrors((prev) => ({ ...prev, debtor: "" }));
  };

  // Select debtor from device contact
  const selectDebtorFromDevice = (deviceContact: DeviceContact) => {
    setSelectedDebtor({ phone_number: deviceContact.phone_number, nickname: deviceContact.name });
    setSearchQuery("");
    setShowDeviceContacts(false);
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
      newErrors.debtor = "Select who owes you";
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

    setSubmitting(true);

    const iouData: IOUInsert = {
      debtor_phone_number: selectedDebtor!.phone_number,
      amount: total,
      currency,
      description: description.trim() || undefined,
      due_date: dueDate?.toISOString(),
    };

    const result = await createIOU(iouData);
    setSubmitting(false);

    if (result) {
      navigate("/ious");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Debtor Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          Who owes you?
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
            {/* Device Contacts List */}
            {showDeviceContacts && filteredDeviceContacts.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Phone Contacts</span>
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
              </div>
            )}

            <div className="relative">
              <Input
                placeholder="Search contacts by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="h-4 w-4" />}
                error={!!errors.debtor}
              />

              {/* Contact dropdown */}
              {searchQuery && filteredContacts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left"
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
          </>
        )}

        {errors.debtor && !selectedDebtor && (
          <p className="text-sm text-destructive">{errors.debtor}</p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleShowDeviceContacts}
            className="text-primary"
            disabled={deviceContactsLoading || !!selectedDebtor}
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
            New Contact
          </Button>
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
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
          icon={<DollarSign className="h-4 w-4" />}
          error={!!errors.amount}
        />
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="What's this IOU for?"
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

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          "Create IOU"
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
