import { Contact } from "@/hooks/useContacts";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Phone, MoreVertical, Pencil, Trash2, Smartphone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ContactCardProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  onClick?: (contact: Contact) => void;
  selectable?: boolean;
  selected?: boolean;
}

export function ContactCard({
  contact,
  onEdit,
  onDelete,
  onClick,
  selectable,
  selected,
}: ContactCardProps) {
  const displayName = contact.nickname || contact.phone_number;
  const isDeviceContact = contact.source === 'device';

  const handleClick = () => {
    if (onClick) onClick(contact);
  };

  return (
    <div
      className={`card-elevated p-4 flex items-center gap-3 transition-all cursor-pointer hover:ring-2 hover:ring-primary/50 ${
        selected ? "ring-2 ring-primary bg-primary/5" : ""
      }`}
      onClick={handleClick}
    >
      <AvatarCustom name={displayName} size="md" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">{displayName}</p>
          {isDeviceContact && (
            <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1">
              <Smartphone className="h-3 w-3" />
              Phone
            </Badge>
          )}
        </div>
        {contact.nickname && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span className="truncate">{contact.phone_number}</span>
          </div>
        )}
      </div>

      {(onEdit || onDelete) && !selectable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(contact)}>
                <Pencil className="mr-2 h-4 w-4" />
                {isDeviceContact ? "Set Nickname" : "Edit"}
              </DropdownMenuItem>
            )}
            {onDelete && !isDeviceContact && (
              <DropdownMenuItem
                onClick={() => onDelete(contact)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
