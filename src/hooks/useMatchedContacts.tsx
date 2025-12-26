import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { supabase } from '@/integrations/supabase/client';
import { extractPhoneSuffix } from '@/lib/phoneUtils';
import { useAuth } from './useAuth';

export interface MatchedContact {
  user_id: string;
  phone_number: string;
  phone_suffix: string;
  username: string;
}

interface CacheEntry {
  data: MatchedContact[];
  timestamp: number;
}

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// In-memory cache
const matchCache = new Map<string, CacheEntry>();

export function useMatchedContacts() {
  const { user } = useAuth();
  const [matchedContacts, setMatchedContacts] = useState<MatchedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const fetchedRef = useRef(false);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getCacheKey = useCallback(() => {
    return user?.id ? `matched_contacts_${user.id}` : null;
  }, [user?.id]);

  const checkCache = useCallback((): MatchedContact[] | null => {
    const cacheKey = getCacheKey();
    if (!cacheKey) return null;

    const cached = matchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Using cached matched contacts');
      return cached.data;
    }
    return null;
  }, [getCacheKey]);

  const setCache = useCallback((data: MatchedContact[]) => {
    const cacheKey = getCacheKey();
    if (cacheKey) {
      matchCache.set(cacheKey, { data, timestamp: Date.now() });
    }
  }, [getCacheKey]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Not a native platform, contacts not available');
      setHasPermission(false);
      return false;
    }

    try {
      const permResult = await Contacts.requestPermissions();
      const granted = permResult.contacts === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (err) {
      console.error('Error requesting contacts permission:', err);
      setHasPermission(false);
      return false;
    }
  }, []);

  const fetchMatchedContacts = useCallback(async (forceRefresh = false): Promise<MatchedContact[]> => {
    if (!user) {
      setError('User not authenticated');
      return [];
    }

    // Check if offline - return cached data or show friendly message
    if (!navigator.onLine) {
      console.log('Offline - returning cached contacts if available');
      const cached = checkCache();
      if (cached) {
        setMatchedContacts(cached);
        setError(null);
        return cached;
      }
      setError('Available when online');
      return [];
    }

    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cached = checkCache();
      if (cached) {
        setMatchedContacts(cached);
        return cached;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Check/request permission
      if (!Capacitor.isNativePlatform()) {
        console.log('Not a native platform, skipping contact matching');
        setError('Device contacts not available on web');
        return [];
      }

      console.log('Requesting contacts permission for matching...');
      const permResult = await Contacts.requestPermissions();
      console.log('Permission result:', permResult);
      
      if (permResult.contacts !== 'granted') {
        setError('Contacts permission denied');
        setHasPermission(false);
        return [];
      }
      setHasPermission(true);

      console.log('Fetching device contacts...');
      // Get device contacts
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
        },
      });

      console.log(`Got ${result.contacts?.length || 0} contacts from device`);

      if (!result.contacts || result.contacts.length === 0) {
        console.log('No contacts found on device');
        setMatchedContacts([]);
        setCache([]);
        return [];
      }

      // Extract unique phone suffixes
      const phoneSet = new Set<string>();
      result.contacts.forEach(contact => {
        contact.phones?.forEach(phone => {
          if (phone.number) {
            const suffix = extractPhoneSuffix(phone.number);
            if (suffix.length >= 7) { // Only valid phone numbers
              phoneSet.add(suffix);
            }
          }
        });
      });

      const phoneSuffixes = Array.from(phoneSet);
      console.log(`Extracted ${phoneSuffixes.length} unique phone suffixes`);

      if (phoneSuffixes.length === 0) {
        setMatchedContacts([]);
        setCache([]);
        return [];
      }

      // Paginate if more than 200 contacts
      const PAGE_SIZE = 200;
      const allMatched: MatchedContact[] = [];

      for (let i = 0; i < phoneSuffixes.length; i += PAGE_SIZE) {
        const batch = phoneSuffixes.slice(i, i + PAGE_SIZE);
        
        console.log(`Sending batch ${i / PAGE_SIZE + 1} with ${batch.length} phone suffixes`);

        try {
          const response = await supabase.functions.invoke('match-contacts', {
            body: { phone_suffixes: batch },
          });

          console.log('Match contacts response:', response);

          if (response.error) {
            // Check if it's an auth/network error
            if (response.error.message?.includes('Failed to fetch') || 
                response.error.message?.includes('network') ||
                response.error.message?.includes('non-2xx')) {
              console.warn('Network error during contact matching, using cache');
              const cached = checkCache();
              if (cached) {
                setMatchedContacts(cached);
                return cached;
              }
              setError('Connection issue. Try again when online.');
              return [];
            }
            throw new Error(response.error.message || 'Failed to match contacts');
          }

          if (response.data?.matched) {
            allMatched.push(...response.data.matched);
          }
        } catch (batchError: any) {
          console.error('Batch error:', batchError);
          // If network fails mid-batch, return what we have or cache
          if (allMatched.length > 0) {
            const uniqueMatched = Array.from(
              new Map(allMatched.map(c => [c.user_id, c])).values()
            );
            setMatchedContacts(uniqueMatched);
            setCache(uniqueMatched);
            return uniqueMatched;
          }
          const cached = checkCache();
          if (cached) {
            setMatchedContacts(cached);
            return cached;
          }
          throw batchError;
        }
      }

      // Deduplicate by user_id
      const uniqueMatched = Array.from(
        new Map(allMatched.map(c => [c.user_id, c])).values()
      );

      console.log(`Matched ${uniqueMatched.length} contacts on Owelink`);

      setMatchedContacts(uniqueMatched);
      setCache(uniqueMatched);
      return uniqueMatched;

    } catch (err: any) {
      console.error('Error fetching matched contacts:', err);
      // Check for network errors and return cached data
      if (err.message?.includes('Failed to fetch') || 
          err.message?.includes('network') ||
          err.message?.includes('non-2xx')) {
        const cached = checkCache();
        if (cached) {
          setMatchedContacts(cached);
          setError(null);
          return cached;
        }
        setError('Connection issue. Try again when online.');
      } else {
        setError(err.message || 'Failed to fetch matched contacts');
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, checkCache, setCache]);

  // Auto-fetch on mount (once)
  useEffect(() => {
    if (user && Capacitor.isNativePlatform() && !fetchedRef.current) {
      fetchedRef.current = true;
      // Check cache first
      const cached = checkCache();
      if (cached) {
        setMatchedContacts(cached);
      } else {
        fetchMatchedContacts();
      }
    }
  }, [user, checkCache, fetchMatchedContacts]);

  const clearCache = useCallback(() => {
    const cacheKey = getCacheKey();
    if (cacheKey) {
      matchCache.delete(cacheKey);
    }
  }, [getCacheKey]);

  const refresh = useCallback(() => {
    clearCache();
    return fetchMatchedContacts(true);
  }, [clearCache, fetchMatchedContacts]);

  return {
    matchedContacts,
    loading,
    error,
    hasPermission,
    isOffline,
    requestPermission,
    fetchMatchedContacts,
    refresh,
    clearCache,
  };
}
