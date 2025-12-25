import Dexie, { Table } from 'dexie';
import { Capacitor } from '@capacitor/core';

// Platform detection
export const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const getPlatform = (): string => {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
};

// Check if IndexedDB is available
export function isIndexedDBAvailable(): boolean {
  try {
    // Check if indexedDB exists
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available - window.indexedDB is undefined');
      return false;
    }
    return true;
  } catch (e) {
    console.warn('IndexedDB check failed:', e);
    return false;
  }
}

// Test IndexedDB by opening a test database
export async function testIndexedDB(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const testDbName = '__idb_test__' + Date.now();
      const request = window.indexedDB.open(testDbName, 1);
      
      request.onerror = () => {
        console.warn('IndexedDB test failed - cannot open database');
        resolve(false);
      };
      
      request.onsuccess = () => {
        try {
          request.result.close();
          window.indexedDB.deleteDatabase(testDbName);
          console.log('IndexedDB test passed');
          resolve(true);
        } catch (e) {
          console.warn('IndexedDB test cleanup failed:', e);
          resolve(true); // Still consider it passed if we could open
        }
      };
      
      request.onblocked = () => {
        console.warn('IndexedDB test blocked');
        resolve(false);
      };
      
      // Timeout after 3 seconds
      setTimeout(() => {
        console.warn('IndexedDB test timed out');
        resolve(false);
      }, 3000);
    } catch (e) {
      console.warn('IndexedDB test exception:', e);
      resolve(false);
    }
  });
}

// Define interfaces for local storage
export interface LocalProfile {
  id: string;
  user_id: string;
  username: string;
  phone_number: string;
  phone_suffix: string | null;
  avatar_url: string | null;
  settings: Record<string, unknown> | null;
  notification_preferences: Record<string, unknown> | null;
  business_mode_enabled: boolean;
  created_at: string;
  updated_at: string;
  synced_at?: number;
}

export interface LocalBill {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalBillParticipant {
  id: string;
  bill_id: string;
  phone_number: string;
  phone_suffix: string | null;
  user_id: string | null;
  amount_owed: number;
  amount_paid: number;
  status: string;
  created_at: string;
  updated_at: string;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalIOU {
  id: string;
  creditor_id: string;
  debtor_phone_number: string;
  debtor_phone_suffix: string | null;
  debtor_user_id: string | null;
  amount: number;
  amount_paid: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalPayment {
  id: string;
  reference_type: string;
  reference_id: string;
  payer_phone_number: string;
  payer_id: string | null;
  amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  synced_at?: number;
  is_local?: boolean;
}

// Legacy LocalContact for sync (deprecated - kept for migration)
export interface LocalContact {
  id: string;
  user_id: string;
  phone_number: string;
  phone_suffix: string | null;
  nickname: string | null;
  linked_profile_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at?: number;
  is_local?: boolean;
}

// NEW: Local-only app contacts (never synced to server)
export interface LocalAppContact {
  id: string;
  phone_number: string;
  phone_suffix: string;
  nickname: string | null;
  created_at: number;
  updated_at: number;
}

// NEW: Nickname overrides for device contacts
export interface NicknameOverride {
  phone_suffix: string; // Primary key
  nickname: string;
  updated_at: number;
}

export interface LocalNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  synced_at?: number;
}

export interface SyncQueueItem {
  id?: number;
  action_id: string;
  entity_type: 'bill' | 'bill_participant' | 'iou' | 'payment' | 'contact' | 'notification';
  operation: 'create' | 'update' | 'delete';
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: number;
  retry_count: number;
  last_error: string | null;
  status: 'pending' | 'processing' | 'failed';
}

export interface SyncMetadata {
  id: string;
  entity_type: string;
  last_synced_at: number;
  last_server_timestamp: string | null;
}

class OfflineDatabase extends Dexie {
  profiles!: Table<LocalProfile, string>;
  bills!: Table<LocalBill, string>;
  billParticipants!: Table<LocalBillParticipant, string>;
  ious!: Table<LocalIOU, string>;
  payments!: Table<LocalPayment, string>;
  contacts!: Table<LocalContact, string>;
  notifications!: Table<LocalNotification, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  syncMetadata!: Table<SyncMetadata, string>;
  // NEW: Local-only tables (not synced to server)
  localAppContacts!: Table<LocalAppContact, string>;
  nicknameOverrides!: Table<NicknameOverride, string>;

  private _isReady = false;
  private _initPromise: Promise<void> | null = null;

  constructor() {
    super('owelink_offline_db');

    this.version(1).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
    });

    // Version 2: Add local-only contacts tables
    this.version(2).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
      // NEW local-only tables
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    // Add error handlers
    this.on('blocked', () => {
      console.warn('Database blocked - another tab may have the database open');
    });

    this.on('versionchange', () => {
      console.log('Database version change detected');
      this.close();
    });
  }

  // Ensure DB is ready before operations
  async ensureReady(): Promise<boolean> {
    if (this._isReady) return true;
    
    if (this._initPromise) {
      await this._initPromise;
      return this._isReady;
    }

    this._initPromise = this._initialize();
    await this._initPromise;
    return this._isReady;
  }

  private async _initialize(): Promise<void> {
    try {
      const platform = getPlatform();
      const isNative = isNativePlatform();
      console.log(`Initializing IndexedDB (Native: ${isNative}, Platform: ${platform})`);

      // First check if IndexedDB is available
      if (!isIndexedDBAvailable()) {
        console.error('IndexedDB is not available on this platform');
        this._isReady = false;
        return;
      }

      // On Android, test IndexedDB first
      if (platform === 'android') {
        console.log('Testing IndexedDB on Android...');
        const testPassed = await testIndexedDB();
        if (!testPassed) {
          console.error('IndexedDB test failed on Android');
          this._isReady = false;
          return;
        }
      }

      // Open the database
      await this.open();
      
      // Verify we can actually read/write
      try {
        const count = await this.syncMetadata.count();
        console.log(`IndexedDB opened, syncMetadata count: ${count}`);
      } catch (verifyError) {
        console.warn('IndexedDB verification failed:', verifyError);
        throw verifyError;
      }

      this._isReady = true;
      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this._isReady = false;
      
      // On Android, try to delete and recreate if there's an issue
      const platform = getPlatform();
      if (platform === 'android') {
        console.log('Attempting to recover IndexedDB on Android...');
        try {
          // Close current connection
          this.close();
          
          // Delete the database
          await new Promise<void>((resolve, reject) => {
            const deleteReq = window.indexedDB.deleteDatabase('owelink_offline_db');
            deleteReq.onsuccess = () => {
              console.log('Old database deleted');
              resolve();
            };
            deleteReq.onerror = () => {
              console.warn('Failed to delete old database');
              reject(deleteReq.error);
            };
            deleteReq.onblocked = () => {
              console.warn('Delete blocked - database in use');
              resolve(); // Continue anyway
            };
          });
          
          // Try to open again
          await this.open();
          this._isReady = true;
          console.log('IndexedDB recovered successfully on Android');
        } catch (retryError) {
          console.error('Failed to recover IndexedDB on Android:', retryError);
          this._isReady = false;
        }
      }
    }
  }

  get isReady(): boolean {
    return this._isReady;
  }

  // Clear all user data (for logout)
  async clearAllData() {
    if (!await this.ensureReady()) {
      console.warn('Cannot clear data - IndexedDB not ready');
      return;
    }
    
    await Promise.all([
      this.profiles.clear(),
      this.bills.clear(),
      this.billParticipants.clear(),
      this.ious.clear(),
      this.payments.clear(),
      this.contacts.clear(),
      this.notifications.clear(),
      this.syncQueue.clear(),
      this.syncMetadata.clear(),
    ]);
  }

  // Get pending sync count
  async getPendingSyncCount(): Promise<number> {
    if (!await this.ensureReady()) return 0;
    
    try {
      return await this.syncQueue.where('status').anyOf(['pending', 'failed']).count();
    } catch (e) {
      console.error('Error getting pending sync count:', e);
      return 0;
    }
  }
}

// Create singleton instance
export const offlineDb = new OfflineDatabase();

// Initialize on load
offlineDb.ensureReady().then(ready => {
  console.log(`Offline DB ready: ${ready}`);
}).catch(e => {
  console.error('Failed to initialize offline DB:', e);
});

// Generate a unique action ID for sync queue
export function generateActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a temporary local ID for new entities
export function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Safe wrapper for database operations
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    if (!await offlineDb.ensureReady()) {
      console.warn('Database not ready, using fallback');
      return fallback;
    }
    return await operation();
  } catch (error) {
    console.error('Database operation failed:', error);
    return fallback;
  }
}
