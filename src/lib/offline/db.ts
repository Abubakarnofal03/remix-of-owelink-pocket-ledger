import Dexie, { Table } from 'dexie';

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
  }

  // Clear all user data (for logout)
  async clearAllData() {
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
    return this.syncQueue.where('status').anyOf(['pending', 'failed']).count();
  }
}

export const offlineDb = new OfflineDatabase();

// Generate a unique action ID for sync queue
export function generateActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a temporary local ID for new entities
export function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
