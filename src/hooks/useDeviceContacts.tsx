import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Contacts } from "@capacitor-community/contacts";

export interface DeviceContact {
  id: string;
  name: string | null;
  phone_number: string;
}

export function useDeviceContacts() {
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const fetchDeviceContacts = useCallback(async (): Promise<DeviceContact[]> => {
    if (!Capacitor.isNativePlatform()) {
      // Web fallback - use Contact Picker API if available
      if ("contacts" in navigator && "ContactsManager" in window) {
        try {
          const props = ["tel", "name"];
          const opts = { multiple: true };
          // @ts-ignore - Contacts API is experimental
          const webContacts = await navigator.contacts.select(props, opts);
          
          const mapped: DeviceContact[] = webContacts
            .filter((c: any) => c.tel && c.tel.length > 0)
            .map((c: any, index: number) => ({
              id: `web-${index}`,
              name: c.name?.[0] || null,
              phone_number: c.tel[0],
            }));
          
          setDeviceContacts(mapped);
          return mapped;
        } catch (error: any) {
          if (error.name !== "AbortError") {
            console.error("Error fetching web contacts:", error);
          }
          return [];
        }
      }
      return [];
    }

    setLoading(true);
    try {
      // Request permission first
      const permResult = await Contacts.requestPermissions();
      if (permResult.contacts !== "granted") {
        setHasPermission(false);
        return [];
      }
      setHasPermission(true);

      // Get all contacts from device
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
        },
      });

      const mapped: DeviceContact[] = result.contacts
        .filter(c => c.phones && c.phones.length > 0 && c.phones[0].number)
        .map((c, index) => ({
          id: c.contactId || `device-${index}`,
          name: c.name?.display || c.name?.given || null,
          phone_number: c.phones![0].number!,
        }));

      setDeviceContacts(mapped);
      return mapped;
    } catch (error) {
      console.error("Error fetching device contacts:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchDeviceContacts = useCallback((query: string): DeviceContact[] => {
    if (!query.trim()) return deviceContacts;
    const q = query.toLowerCase();
    return deviceContacts.filter(
      c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone_number.includes(q)
    );
  }, [deviceContacts]);

  return {
    deviceContacts,
    loading,
    hasPermission,
    fetchDeviceContacts,
    searchDeviceContacts,
  };
}
