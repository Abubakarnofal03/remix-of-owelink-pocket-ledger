import React, { useCallback, useMemo } from "react";
import { Contact } from "@/hooks/useContacts";
import { AvatarCustom } from "@/components/ui/avatar-custom";
import { Phone, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ContactCardProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  onClick?: (contact: Contact) => void;
  selectable?: boolean;
  selected?: boolean;
}

export const ContactCard: React.FC<ContactCardProps> = React.memo(({
  contact,
  onEdit,
  onDelete,
  onClick,
  selectable,
  selected,
}) => {
  const displayName = useMemo(() => 
    contact.nickname || contact.phone_number, 
    [contact.nickname, contact.phone_number]
  );

  const handleClick = useCallback(() => {
    if (onClick) onClick(contact);
  }, [onClick, contact]);

  const handleEdit = useCallback(() => {
    if (onEdit) onEdit(contact);
  }, [onEdit, contact]);

  const handleDelete = useCallback(() => {
    if (onDelete) onDelete(contact);
  }, [onDelete, contact]);

  const handleDropdownClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`card-elevated p-4 flex items-center gap-3 transition-all cursor-pointer hover:ring-2 hover:ring-primary/50 ${
        selected ? "ring-2 ring-primary bg-primary/5" : ""
      }`}
      onClick={handleClick}
    >
      <AvatarCustom name={displayName} size="md" />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{displayName}</p>
        {contact.nickname && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span className="truncate">{contact.phone_number}</span>
          </div>
        )}
      </div>

      {(onEdit || onDelete) && !selectable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={handleDropdownClick}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={handleEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={handleDelete}
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
});

ContactCard.displayName = "ContactCard";
