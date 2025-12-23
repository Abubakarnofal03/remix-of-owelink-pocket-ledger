import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { extractPhoneSuffix } from "@/lib/phoneUtils";

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

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("nickname", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const addContact = async (contact: ContactInsert): Promise<Contact | null> => {
    if (!user) return null;

    // Check for duplicate using phone_suffix matching
    const newSuffix = extractPhoneSuffix(contact.phone_number);
    const existing = contacts.find(c => 
      c.phone_suffix === newSuffix || extractPhoneSuffix(c.phone_number) === newSuffix
    );
    if (existing) {
      toast.error("Contact with this phone number already exists");
      return null;
    }

    try {
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

      // Update local cache
      setContacts(prev => [...prev, data]);
      toast.success("Contact added");
      return data;
    } catch (error: any) {
      console.error("Error adding contact:", error);
      toast.error("Failed to add contact");
      return null;
    }
  };

  const updateContact = async (id: string, updates: Partial<ContactInsert>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      // Update local cache
      setContacts(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c))
      );
      toast.success("Contact updated");
      return true;
    } catch (error: any) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
      return false;
    }
  };

  const deleteContact = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Update local cache
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success("Contact deleted");
      return true;
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
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

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    importContactsFromDevice,
    searchContacts,
    refetch: fetchContacts,
  };
}
