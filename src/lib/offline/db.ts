import Dexie, { Table } from '@/lib/dexie';
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
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[OfflineDB] IndexedDB not available - window.indexedDB is undefined');
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[OfflineDB] IndexedDB check failed:', e);
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
        console.warn('[OfflineDB] IndexedDB test failed - cannot open database');
        resolve(false);
      };
      
      request.onsuccess = () => {
        try {
          request.result.close();
          window.indexedDB.deleteDatabase(testDbName);
          console.log('[OfflineDB] IndexedDB test passed');
          resolve(true);
        } catch (e) {
          console.warn('[OfflineDB] IndexedDB test cleanup failed:', e);
          resolve(true);
        }
      };
      
      request.onblocked = () => {
        console.warn('[OfflineDB] IndexedDB test blocked');
        resolve(false);
      };
      
      setTimeout(() => {
        console.warn('[OfflineDB] IndexedDB test timed out');
        resolve(false);
      }, 5000);
    } catch (e) {
      console.warn('[OfflineDB] IndexedDB test exception:', e);
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
  reminder_enabled?: boolean;
  reminder_interval_days?: number | null;
  last_reminder_sent_at?: string | null;
  receipt_url?: string | null;
  synced_at?: number;
  is_local?: boolean;
  // Creator info (for participant/debtor view)
  creator_username?: string | null;
  creator_phone_number?: string | null;
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
  reminder_enabled?: boolean;
  reminder_interval_days?: number | null;
  last_reminder_sent_at?: string | null;
  is_pinned?: boolean;
  direction?: string; // 'owed_to_me' | 'i_owe'
  synced_at?: number;
  is_local?: boolean;
  // Creditor info (for debtor view)
  creditor_username?: string | null;
  creditor_phone_number?: string | null;
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

export interface LocalAppContact {
  id: string;
  phone_number: string;
  phone_suffix: string;
  nickname: string | null;
  created_at: number;
  updated_at: number;
}

export interface NicknameOverride {
  phone_suffix: string;
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

export interface LocalPaymentRequest {
  id: string;
  bill_id: string;
  participant_id: string;
  requester_phone_suffix: string;
  amount_claimed: number;
  receipt_url: string | null;
  status: string;
  message: string | null;
  creator_response: string | null;
  created_at: string;
  updated_at: string;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalIOUPaymentRequest {
  id: string;
  iou_id: string;
  requester_phone_suffix: string;
  amount_claimed: number;
  receipt_url: string | null;
  status: string;
  message: string | null;
  creator_response: string | null;
  created_at: string;
  updated_at: string;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalExpense {
  id: string;
  user_id: string;
  amount: number;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reference_type: string | null;
  reference_id: string | null;
  bucket_id: string | null;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalExpenseBucket {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalBillNotice {
  id: string;
  bill_id: string;
  author_phone_suffix: string;
  message: string;
  color: string;
  created_at: string;
  updated_at: string;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalIOUNotice {
  id: string;
  iou_id: string;
  author_phone_suffix: string;
  message: string;
  color: string;
  created_at: string;
  updated_at: string;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalExpenseGroup {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalExpenseGroupMember {
  id: string;
  group_id: string;
  phone_number: string;
  phone_suffix: string | null;
  user_id: string | null;
  nickname: string | null;
  created_at: string;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalGroupExpense {
  id: string;
  group_id: string;
  paid_by_member_id: string;
  amount: number;
  description: string | null;
  split_type: string;
  split_details: any;
  created_at: string;
  deleted_at: string | null;
  synced_at?: number;
  is_local?: boolean;
}

export interface LocalTxnSignal {
  id: string;            // fingerprint
  amount: number;
  merchant: string | null;
  source: string | null; // package name or sms sender
  timestamp: number;
  rawText: string;
  createdAt: number;
}

export interface LocalExpenseSuggestion {
  id: string;
  amount: number;
  currency: string;
  merchant: string | null;
  category: string | null;
  bucketId: string | null;
  source: string | null;
  timestamp: number;
  rawText: string;
  confidence: number;
  status: 'pending' | 'added' | 'ignored' | 'reviewed';
  createdAt: number;
}

export interface SyncQueueItem {
  id?: number;
  action_id: string;
  entity_type: 'bill' | 'bill_participant' | 'iou' | 'payment' | 'contact' | 'notification' | 'payment_request' | 'iou_payment_request' | 'expense' | 'expense_bucket' | 'bill_notice' | 'iou_notice' | 'expense_group' | 'expense_group_member' | 'group_expense';
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

// Store DB state for diagnostics
export interface DbDiagnostics {
  isReady: boolean;
  lastError: string | null;
  initAttempts: number;
  platform: string;
  lastInitTime: number | null;
}

let dbDiagnostics: DbDiagnostics = {
  isReady: false,
  lastError: null,
  initAttempts: 0,
  platform: 'unknown',
  lastInitTime: null,
};

export function getDbDiagnostics(): DbDiagnostics {
  return { ...dbDiagnostics };
}

class OfflineDatabase extends Dexie {
  profiles!: Table<LocalProfile, string>;
  bills!: Table<LocalBill, string>;
  billParticipants!: Table<LocalBillParticipant, string>;
  ious!: Table<LocalIOU, string>;
  payments!: Table<LocalPayment, string>;
  contacts!: Table<LocalContact, string>;
  notifications!: Table<LocalNotification, string>;
  paymentRequests!: Table<LocalPaymentRequest, string>;
  iouPaymentRequests!: Table<LocalIOUPaymentRequest, string>;
  expenses!: Table<LocalExpense, string>;
  expenseBuckets!: Table<LocalExpenseBucket, string>;
  billNotices!: Table<LocalBillNotice, string>;
  expenseGroups!: Table<LocalExpenseGroup, string>;
  expenseGroupMembers!: Table<LocalExpenseGroupMember, string>;
  groupExpenses!: Table<LocalGroupExpense, string>;
  iouNotices!: Table<LocalIOUNotice, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  syncMetadata!: Table<SyncMetadata, string>;
  localAppContacts!: Table<LocalAppContact, string>;
  nicknameOverrides!: Table<NicknameOverride, string>;
  txnSignals!: Table<LocalTxnSignal, string>;
  expenseSuggestions!: Table<LocalExpenseSuggestion, string>;

  private _isReady = false;
  private _initPromise: Promise<boolean> | null = null;
  private _lastError: string | null = null;
  private _initAttempts = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;

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
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    this.version(3).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      paymentRequests: 'id, bill_id, participant_id, status, created_at, synced_at',
      iouPaymentRequests: 'id, iou_id, status, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    this.version(4).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      paymentRequests: 'id, bill_id, participant_id, status, created_at, synced_at',
      iouPaymentRequests: 'id, iou_id, status, created_at, synced_at',
      expenses: 'id, user_id, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    // Version 5: Add expense buckets
    this.version(5).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      paymentRequests: 'id, bill_id, participant_id, status, created_at, synced_at',
      iouPaymentRequests: 'id, iou_id, status, created_at, synced_at',
      expenses: 'id, user_id, bucket_id, created_at, synced_at',
      expenseBuckets: 'id, user_id, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    // Version 6: Add bill notices
    this.version(6).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      paymentRequests: 'id, bill_id, participant_id, status, created_at, synced_at',
      iouPaymentRequests: 'id, iou_id, status, created_at, synced_at',
      expenses: 'id, user_id, bucket_id, created_at, synced_at',
      expenseBuckets: 'id, user_id, created_at, synced_at',
      billNotices: 'id, bill_id, author_phone_suffix, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    // Version 7: Add expense groups, members, and group expenses
    this.version(7).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      paymentRequests: 'id, bill_id, participant_id, status, created_at, synced_at',
      iouPaymentRequests: 'id, iou_id, status, created_at, synced_at',
      expenses: 'id, user_id, bucket_id, created_at, synced_at',
      expenseBuckets: 'id, user_id, created_at, synced_at',
      billNotices: 'id, bill_id, author_phone_suffix, created_at, synced_at',
      expenseGroups: 'id, creator_id, created_at, synced_at',
      expenseGroupMembers: 'id, group_id, phone_number, synced_at',
      groupExpenses: 'id, group_id, paid_by_member_id, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    // Version 8: Add IOU notices
    this.version(8).stores({
      profiles: 'id, user_id, phone_suffix, synced_at',
      bills: 'id, creator_id, status, created_at, updated_at, synced_at',
      billParticipants: 'id, bill_id, phone_number, phone_suffix, user_id, synced_at',
      ious: 'id, creditor_id, debtor_phone_suffix, debtor_user_id, status, created_at, synced_at',
      payments: 'id, reference_type, reference_id, payer_phone_number, synced_at',
      contacts: 'id, user_id, phone_number, phone_suffix, synced_at',
      notifications: 'id, user_id, read, created_at, synced_at',
      paymentRequests: 'id, bill_id, participant_id, status, created_at, synced_at',
      iouPaymentRequests: 'id, iou_id, status, created_at, synced_at',
      expenses: 'id, user_id, bucket_id, created_at, synced_at',
      expenseBuckets: 'id, user_id, created_at, synced_at',
      billNotices: 'id, bill_id, author_phone_suffix, created_at, synced_at',
      iouNotices: 'id, iou_id, author_phone_suffix, created_at, synced_at',
      expenseGroups: 'id, creator_id, created_at, synced_at',
      expenseGroupMembers: 'id, group_id, phone_number, synced_at',
      groupExpenses: 'id, group_id, paid_by_member_id, created_at, synced_at',
      syncQueue: '++id, action_id, entity_type, operation, entity_id, status, created_at',
      syncMetadata: 'id, entity_type, last_synced_at',
      localAppContacts: 'id, phone_suffix, nickname, created_at',
      nicknameOverrides: 'phone_suffix, updated_at',
    });

    this.on('blocked', () => {
      console.warn('[OfflineDB] Database blocked - another tab may have the database open');
    });

    this.on('versionchange', () => {
      console.log('[OfflineDB] Database version change detected');
      this.close();
    });
  }

  async ensureReady(): Promise<boolean> {
    // Already ready
    if (this._isReady) return true;
    
    // Init in progress, wait for it
    if (this._initPromise) {
      return this._initPromise;
    }

    // Start init
    this._initPromise = this._initializeWithRetry();
    const result = await this._initPromise;
    this._initPromise = null; // Allow retry on next call if failed
    return result;
  }

  private async _initializeWithRetry(): Promise<boolean> {
    const platform = getPlatform();
    dbDiagnostics.platform = platform;
    
    while (this._initAttempts < this.MAX_INIT_ATTEMPTS) {
      this._initAttempts++;
      dbDiagnostics.initAttempts = this._initAttempts;
      
      console.log(`[OfflineDB] Init attempt ${this._initAttempts}/${this.MAX_INIT_ATTEMPTS} (Platform: ${platform})`);
      
      const success = await this._initialize();
      if (success) {
        return true;
      }
      
      // Wait before retry with exponential backoff
      if (this._initAttempts < this.MAX_INIT_ATTEMPTS) {
        const delay = Math.pow(2, this._initAttempts) * 500;
        console.log(`[OfflineDB] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    console.error('[OfflineDB] All init attempts failed');
    return false;
  }

  private async _initialize(): Promise<boolean> {
    try {
      dbDiagnostics.lastInitTime = Date.now();
      
      // Check if IndexedDB is available
      if (!isIndexedDBAvailable()) {
        this._lastError = 'IndexedDB not available';
        dbDiagnostics.lastError = this._lastError;
        console.error('[OfflineDB] ' + this._lastError);
        return false;
      }

      // On Android, do a quick test first
      const platform = getPlatform();
      if (platform === 'android') {
        console.log('[OfflineDB] Testing IndexedDB on Android...');
        const testPassed = await testIndexedDB();
        if (!testPassed) {
          this._lastError = 'IndexedDB test failed on Android';
          dbDiagnostics.lastError = this._lastError;
          console.error('[OfflineDB] ' + this._lastError);
          
          // Try recovery
          return await this._recoverDatabase();
        }
      }

      // Open the database (guard against rare WebView hangs)
      await Promise.race([
        this.open(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('IndexedDB open timed out')), 3000)
        ),
      ]);

      try {
        const count = await this.syncMetadata.count();
        console.log(`[OfflineDB] Verified - syncMetadata count: ${count}`);
      } catch (verifyError) {
        console.warn('[OfflineDB] Verification failed:', verifyError);
        throw verifyError;
      }

      this._isReady = true;
      this._lastError = null;
      dbDiagnostics.isReady = true;
      dbDiagnostics.lastError = null;
      console.log('[OfflineDB] ✓ Initialized successfully');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this._lastError = errorMsg;
      dbDiagnostics.lastError = errorMsg;
      console.error('[OfflineDB] Init failed:', errorMsg);
      
      // On Android, try recovery
      const platform = getPlatform();
      if (platform === 'android') {
        return await this._recoverDatabase();
      }
      
      return false;
    }
  }

  private async _recoverDatabase(): Promise<boolean> {
    console.log('[OfflineDB] Attempting database recovery...');
    
    try {
      // Close current connection
      this.close();
      
      // Delete the database
      await new Promise<void>((resolve, reject) => {
        const deleteReq = window.indexedDB.deleteDatabase('owelink_offline_db');
        deleteReq.onsuccess = () => {
          console.log('[OfflineDB] Old database deleted');
          resolve();
        };
        deleteReq.onerror = () => {
          console.warn('[OfflineDB] Failed to delete old database');
          reject(deleteReq.error);
        };
        deleteReq.onblocked = () => {
          console.warn('[OfflineDB] Delete blocked - database in use');
          resolve();
        };
        setTimeout(() => resolve(), 3000);
      });
      
      // Try to open again (guard against rare WebView hangs)
      await Promise.race([
        this.open(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('IndexedDB open timed out')), 3000)
        ),
      ]);
      
      // Verify
      await this.syncMetadata.count();
      
      this._isReady = true;
      this._lastError = null;
      dbDiagnostics.isReady = true;
      dbDiagnostics.lastError = null;
      console.log('[OfflineDB] ✓ Recovery successful');
      return true;
    } catch (retryError) {
      const errorMsg = retryError instanceof Error ? retryError.message : String(retryError);
      this._lastError = 'Recovery failed: ' + errorMsg;
      dbDiagnostics.lastError = this._lastError;
      console.error('[OfflineDB] Recovery failed:', errorMsg);
      return false;
    }
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  // Test write and read
  async testReadWrite(): Promise<{ success: boolean; error?: string }> {
    if (!this._isReady) {
      return { success: false, error: 'Database not ready' };
    }
    
    try {
      const testId = '__test__' + Date.now();
      await this.syncMetadata.put({
        id: testId,
        entity_type: 'test',
        last_synced_at: Date.now(),
        last_server_timestamp: null,
      });
      
      const read = await this.syncMetadata.get(testId);
      await this.syncMetadata.delete(testId);
      
      if (read && read.id === testId) {
        return { success: true };
      }
      return { success: false, error: 'Read verification failed' };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async clearAllData() {
    if (!await this.ensureReady()) {
      console.warn('[OfflineDB] Cannot clear data - not ready');
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
      this.paymentRequests.clear(),
      this.iouPaymentRequests.clear(),
      this.billNotices.clear(),
      this.iouNotices.clear(),
      this.expenseGroups.clear(),
      this.expenseGroupMembers.clear(),
      this.groupExpenses.clear(),
      this.syncQueue.clear(),
      this.syncMetadata.clear(),
    ]);
    console.log('[OfflineDB] All data cleared');
  }

  async getPendingSyncCount(): Promise<number> {
    if (!await this.ensureReady()) return 0;

    try {
      // User requested: don't surface deleted/archived bills in "Pending"
      return await this.syncQueue
        .where('status')
        .anyOf(['pending', 'failed'])
        .filter(i => !(i.entity_type === 'bill' && i.operation === 'delete'))
        .count();
    } catch (e) {
      console.error('[OfflineDB] Error getting pending sync count:', e);
      return 0;
    }
  }
}

// Create singleton instance
export const offlineDb = new OfflineDatabase();

// Initialize on load
offlineDb.ensureReady().then(ready => {
  console.log(`[OfflineDB] Ready: ${ready}`);
}).catch(e => {
  console.error('[OfflineDB] Failed to initialize:', e);
});

// Generate a unique action ID for sync queue
export function generateActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a UUID for idempotent sync (can be used as server ID)
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Generate a temporary local ID for new entities
// Uses UUID format so it can be used directly on server (idempotent upsert)
export function generateLocalId(): string {
  return crypto.randomUUID();
}

// Safe wrapper for database operations
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    if (!await offlineDb.ensureReady()) {
      console.warn('[OfflineDB] Not ready, using fallback');
      return fallback;
    }
    return await operation();
  } catch (error) {
    console.error('[OfflineDB] Operation failed:', error);
    return fallback;
  }
}
