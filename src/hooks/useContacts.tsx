import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { extractPhoneSuffix } from "@/lib/phoneUtils";
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";
import {
  getLocalContacts,
  addLocalContact,
  updateLocalContact,
  deleteLocalContact,
  searchLocalContacts,
  getAllNicknameOverrides,
  setNicknameOverride,
} from "@/lib/contactsDb";
import { LocalAppContact } from "@/lib/offline/db";

export interface Contact {
  id: string;
  phone_number: string;
  phone_suffix: string;
  nickname: string | null;
  source: 'local' | 'device';
  created_at: string;
  updated_at: string;
}

export interface ContactInsert {
  phone_number: string;
  nickname?: string;
}

interface DeviceContact {
  id: string;
  name: string | null;
  phone_number: string;
  phone_suffix: string;
}

/**
 * useContacts - Local-only contacts hook
 * 
 * Contacts are stored locally on the device:
 * - Custom contacts: Stored in IndexedDB (Dexie)
 * - Device contacts: Read directly from phone's contact book
 * - Nickname overrides: Stored in IndexedDB for device contact nicknames
 * 
 * NO contacts are stored in Supabase database.
 */
export function useContacts() {
  const { user } = useAuth();
  const [localContacts, setLocalContacts] = useState<LocalAppContact[]>([]);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [nicknameOverrides, setNicknameOverrides] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Load local contacts and nickname overrides from IndexedDB
  const loadLocalData = useCallback(async () => {
    try {
      const [contacts, overrides] = await Promise.all([
        getLocalContacts(),
        getAllNicknameOverrides(),
      ]);
      setLocalContacts(contacts);
      setNicknameOverrides(overrides);
    } catch (error) {
      console.error("Error loading local contacts:", error);
    }
  }, []);

  // Fetch device contacts using Capacitor
  const fetchDeviceContacts = useCallback(async (): Promise<DeviceContact[]> => {
    if (!Capacitor.isNativePlatform()) {
      console.log("Not native platform, skipping device contacts");
      return [];
    }

    try {
      // Request permission
      const permResult = await Contacts.requestPermissions();
      if (permResult.contacts !== "granted") {
        setHasPermission(false);
        return [];
      }
      setHasPermission(true);

      // Get contacts from device
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
        },
      });

      const mapped: DeviceContact[] = (result.contacts || [])
        .filter(c => c.phones && c.phones.length > 0 && c.phones[0].number)
        .map((c, index) => ({
          id: c.contactId || `device-${index}`,
          name: c.name?.display || c.name?.given || null,
          phone_number: c.phones![0].number!,
          phone_suffix: extractPhoneSuffix(c.phones![0].number!),
        }));

      setDeviceContacts(mapped);
      return mapped;
    } catch (error) {
      console.error("Error fetching device contacts:", error);
      return [];
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setLoading(true);
      await Promise.all([
        loadLocalData(),
        fetchDeviceContacts(),
      ]);
      setLoading(false);
    };

    init();
  }, [user, loadLocalData, fetchDeviceContacts]);

  // Convert to unified Contact format
  const contacts: Contact[] = [
    // Local app contacts
    ...localContacts.map(c => ({
      id: c.id,
      phone_number: c.phone_number,
      phone_suffix: c.phone_suffix,
      nickname: c.nickname,
      source: 'local' as const,
      created_at: new Date(c.created_at).toISOString(),
      updated_at: new Date(c.updated_at).toISOString(),
    })),
    // Device contacts (filtered to exclude those already in local contacts)
    ...deviceContacts
      .filter(dc => !localContacts.some(lc => lc.phone_suffix === dc.phone_suffix))
      .map(dc => ({
        id: dc.id,
        phone_number: dc.phone_number,
        phone_suffix: dc.phone_suffix,
        nickname: nicknameOverrides.get(dc.phone_suffix) || dc.name,
        source: 'device' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
  ].sort((a, b) => {
    const nameA = a.nickname?.toLowerCase() || a.phone_number;
    const nameB = b.nickname?.toLowerCase() || b.phone_number;
    return nameA.localeCompare(nameB);
  });

  // Add a new contact (saves to local IndexedDB)
  const addContact = async (contact: ContactInsert): Promise<Contact | null> => {
    try {
      const newContact = await addLocalContact(
        contact.phone_number,
        contact.nickname || null
      );
      
      setLocalContacts(prev => [...prev, newContact]);
      toast.success("Contact added");
      
      return {
        id: newContact.id,
        phone_number: newContact.phone_number,
        phone_suffix: newContact.phone_suffix,
        nickname: newContact.nickname,
        source: 'local',
        created_at: new Date(newContact.created_at).toISOString(),
        updated_at: new Date(newContact.updated_at).toISOString(),
      };
    } catch (error: any) {
      console.error("Error adding contact:", error);
      toast.error(error.message || "Failed to add contact");
      return null;
    }
  };

  // Update a contact
  const updateContact = async (id: string, updates: Partial<ContactInsert>): Promise<boolean> => {
    try {
      const contact = contacts.find(c => c.id === id);
      if (!contact) return false;

      if (contact.source === 'local') {
        // Update local contact
        const updated = await updateLocalContact(id, {
          nickname: updates.nickname,
          phone_number: updates.phone_number,
        });
        if (updated) {
          setLocalContacts(prev => prev.map(c => c.id === id ? updated : c));
          toast.success("Contact updated");
          return true;
        }
      } else if (contact.source === 'device' && updates.nickname) {
        // Set nickname override for device contact
        await setNicknameOverride(contact.phone_suffix, updates.nickname);
        setNicknameOverrides(prev => new Map(prev).set(contact.phone_suffix, updates.nickname!));
        toast.success("Nickname updated");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
      return false;
    }
  };

  // Delete a contact (only local contacts can be deleted)
  const deleteContactFn = async (id: string): Promise<boolean> => {
    try {
      const contact = contacts.find(c => c.id === id);
      if (!contact) return false;

      if (contact.source === 'local') {
        const success = await deleteLocalContact(id);
        if (success) {
          setLocalContacts(prev => prev.filter(c => c.id !== id));
          toast.success("Contact deleted");
          return true;
        }
      } else {
        toast.error("Cannot delete device contacts from the app");
      }
      return false;
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
      return false;
    }
  };

  // Search contacts
  const searchContactsFn = useCallback((query: string): Contact[] => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      c => c.nickname?.toLowerCase().includes(q) || c.phone_number.includes(q)
    );
  }, [contacts]);

  // Get contact by ID
  const getContactById = (id: string): Contact | undefined => {
    return contacts.find(c => c.id === id);
  };

  // Refresh contacts
  const refetch = async () => {
    setLoading(true);
    await Promise.all([
      loadLocalData(),
      fetchDeviceContacts(),
    ]);
    setLoading(false);
  };

  return {
    contacts,
    loading,
    hasPermission,
    addContact,
    updateContact,
    deleteContact: deleteContactFn,
    searchContacts: searchContactsFn,
    getContactById,
    refetch,
    // Expose for direct access if needed
    localContacts,
    deviceContacts,
  };
}

// Hook for single contact detail
export function useContactDetail(contactId: string | undefined) {
  const { contacts, loading } = useContacts();
  const contact = contacts.find(c => c.id === contactId);

  return {
    contact,
    loading: loading && !contact,
  };
}
