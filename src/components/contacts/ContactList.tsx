import { Contact } from "@/hooks/useContacts";
import { ContactCard } from "./ContactCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ContactListProps {
  contacts: Contact[];
  loading?: boolean;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  onClick?: (contact: Contact) => void;
  selectable?: boolean;
  selectedIds?: string[];
}

export function ContactList({
  contacts,
  loading,
  onEdit,
  onDelete,
  onClick,
  selectable,
  selectedIds = [],
}: ContactListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card-elevated p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          onEdit={onEdit}
          onDelete={onDelete}
          onClick={onClick}
          selectable={selectable}
          selected={selectedIds.includes(contact.id)}
        />
      ))}
    </div>
  );
}
