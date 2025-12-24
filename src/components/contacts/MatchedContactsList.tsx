import { useMatchedContacts, MatchedContact } from '@/hooks/useMatchedContacts';
import { AvatarCustom } from '@/components/ui/avatar-custom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Users, Phone, AlertCircle } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phoneUtils';
import { Capacitor } from '@capacitor/core';

interface MatchedContactsListProps {
  onSelectContact?: (contact: MatchedContact) => void;
  selectable?: boolean;
}

export function MatchedContactsList({ onSelectContact, selectable = false }: MatchedContactsListProps) {
  const { 
    matchedContacts, 
    loading, 
    error, 
    hasPermission, 
    requestPermission, 
    refresh 
  } = useMatchedContacts();

  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    return (
      <div className="p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Phone className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">
          Contact matching is only available in the mobile app
        </p>
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Contacts permission is required to find friends on Owelink
        </p>
        <Button variant="outline" onClick={requestPermission}>
          Grant Permission
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Finding contacts...</span>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-destructive text-sm mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (matchedContacts.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm mb-1">No contacts on Owelink yet</p>
        <p className="text-muted-foreground text-xs">
          Invite friends to start splitting bills together
        </p>
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-4"
          onClick={() => refresh()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          On Owelink ({matchedContacts.length})
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => refresh()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      <div className="space-y-1 px-2">
        {matchedContacts.map(contact => (
          <div
            key={contact.user_id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
              selectable 
                ? 'cursor-pointer hover:bg-accent active:scale-[0.98]' 
                : 'bg-muted/30'
            }`}
            onClick={() => selectable && onSelectContact?.(contact)}
          >
            <AvatarCustom name={contact.username} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {contact.username}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {formatPhoneForDisplay(contact.phone_number)}
              </p>
            </div>
            {selectable && (
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
