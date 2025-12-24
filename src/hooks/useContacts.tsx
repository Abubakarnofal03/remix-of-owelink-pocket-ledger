import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { extractPhoneSuffix } from "@/lib/phoneUtils";
import { useCallback } from "react";

export interface Contact {
  id: string;
  phone_number: string;
  phone_suffix: string | null;
  nickname: string | null;
  linked_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactInsert {
  phone_number: string;
  nickname?: string;
}

const CONTACTS_QUERY_KEY = ["contacts"];

async function fetchContacts(userId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("nickname", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

export function useContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading: loading } = useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: () => fetchContacts(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const addContactMutation = useMutation({
    mutationFn: async (contact: ContactInsert) => {
      if (!user) throw new Error("Not authenticated");

      // Check for duplicate using phone_suffix matching
      const newSuffix = extractPhoneSuffix(contact.phone_number);
      const existing = contacts.find(c => 
        c.phone_suffix === newSuffix || extractPhoneSuffix(c.phone_number) === newSuffix
      );
      if (existing) {
        throw new Error("Contact with this phone number already exists");
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          user_id: user.id,
          phone_number: contact.phone_number,
          nickname: contact.nickname || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newContact) => {
      queryClient.setQueryData<Contact[]>(["contacts", user?.id], (old = []) => [...old, newContact]);
      toast.success("Contact added");
    },
    onError: (error: any) => {
      console.error("Error adding contact:", error);
      toast.error(error.message || "Failed to add contact");
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContactInsert> }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Contact[]>(["contacts", user?.id], (old = []) =>
        old.map(c => c.id === data.id ? data : c)
      );
      toast.success("Contact updated");
    },
    onError: (error: any) => {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Contact[]>(["contacts", user?.id], (old = []) =>
        old.filter(c => c.id !== id)
      );
      toast.success("Contact deleted");
    },
    onError: (error: any) => {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    },
  });

  const addContact = async (contact: ContactInsert): Promise<Contact | null> => {
    try {
      return await addContactMutation.mutateAsync(contact);
    } catch {
      return null;
    }
  };

  const updateContact = async (id: string, updates: Partial<ContactInsert>): Promise<boolean> => {
    try {
      await updateContactMutation.mutateAsync({ id, updates });
      return true;
    } catch {
      return false;
    }
  };

  const deleteContact = async (id: string): Promise<boolean> => {
    try {
      await deleteContactMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  };

  const importContactsFromDevice = async (): Promise<number> => {
    // Check if Contacts API is available (for PWA/Capacitor)
    if (!("contacts" in navigator && "ContactsManager" in window)) {
      toast.error("Contact import not supported on this device");
      return 0;
    }

    try {
      const props = ["tel", "name"];
      const opts = { multiple: true };
      
      // @ts-ignore - Contacts API is experimental
      const deviceContacts = await navigator.contacts.select(props, opts);
      
      let imported = 0;
      for (const contact of deviceContacts) {
        if (contact.tel && contact.tel.length > 0) {
          const phone = contact.tel[0];
          const phoneSuffix = extractPhoneSuffix(phone);
          const name = contact.name?.[0] || null;
          
          // Skip if already exists (check by phone_suffix)
          if (contacts.find(c => c.phone_suffix === phoneSuffix || extractPhoneSuffix(c.phone_number) === phoneSuffix)) continue;
          
          const result = await addContact({
            phone_number: phone,
            nickname: name || undefined,
          });
          
          if (result) imported++;
        }
      }
      
      if (imported > 0) {
        toast.success(`Imported ${imported} contacts`);
      }
      return imported;
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Error importing contacts:", error);
        toast.error("Failed to import contacts");
      }
      return 0;
    }
  };

  const searchContacts = useCallback((query: string): Contact[] => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      c =>
        c.nickname?.toLowerCase().includes(q) ||
        c.phone_number.includes(q)
    );
  }, [contacts]);

  const getContactById = (id: string): Contact | undefined => {
    return contacts.find(c => c.id === id);
  };

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    importContactsFromDevice,
    searchContacts,
    getContactById,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["contacts", user?.id] }),
  };
}

// Hook for single contact detail (uses cache first)
export function useContactDetail(contactId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Try to get from cache first
  const cachedContacts = queryClient.getQueryData<Contact[]>(["contacts", user?.id]);
  const cachedContact = cachedContacts?.find(c => c.id === contactId);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, linked_profile:profiles!contacts_linked_profile_id_fkey(user_id, phone_suffix)")
        .eq("id", contactId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!contactId && !cachedContact,
    initialData: cachedContact,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    contact: contact || cachedContact,
    loading: isLoading && !cachedContact,
  };
}
