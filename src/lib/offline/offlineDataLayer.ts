import { supabase } from "@/integrations/supabase/client";
import { offlineDb, generateLocalId, LocalBill, LocalBillParticipant, LocalIOU, LocalPayment, safeDbOperation } from "./db";
import { addToSyncQueue } from "./syncQueue";
import { getPhoneSuffix } from "@/lib/notifications";

// Check if we're online
export const isOnline = () => navigator.onLine;

// Check if local DB is available
export const isLocalDbAvailable = async (): Promise<boolean> => {
  try {
    return await offlineDb.ensureReady();
  } catch {
    return false;
  }
};

// ==================== BILLS ====================

export interface BillInsertOffline {
  title: string;
  description?: string;
  total_amount: number;
  currency?: string;
  due_date?: string;
  reminder_enabled?: boolean;
  reminder_interval_days?: number;
  receipt_url?: string;
  participants: {
    phone_number: string;
    amount_owed: number;
    status?: string;
    amount_paid?: number;
  }[];
}

export async function fetchBillsOfflineFirst(userId: string): Promise<LocalBill[]> {
  const dbReady = await isLocalDbAvailable();
  
  if (!dbReady) {
    console.log('[Offline] Local DB not available, returning empty array');
    return [];
  }

  return safeDbOperation(async () => {
    const localBills = await offlineDb.bills
      .filter(b => !b.deleted_at)
      .toArray();

    const billsWithParticipants = await Promise.all(
      localBills.map(async (bill) => {
        const participants = await offlineDb.billParticipants
          .where("bill_id")
          .equals(bill.id)
          .toArray();
        return { ...bill, participants };
      })
    );

    return billsWithParticipants;
  }, []);
}

export async function createBillOfflineFirst(
  userId: string,
  bill: BillInsertOffline
): Promise<LocalBill & { participants: LocalBillParticipant[] }> {
  const dbReady = await isLocalDbAvailable();
  if (!dbReady) throw new Error('Local DB not available');

  const now = new Date().toISOString();
  const localBillId = generateLocalId();
  const currency = bill.currency || "USD";

  const localBill: LocalBill = {
    id: localBillId,
    creator_id: userId,
    title: bill.title,
    description: bill.description || null,
    total_amount: bill.total_amount,
    currency,
    due_date: bill.due_date || null,
    status: "pending",
    created_at: now,
    updated_at: now,
    deleted_at: null,
    // Explicitly default to false if undefined
    reminder_enabled: bill.reminder_enabled === true,
    reminder_interval_days: bill.reminder_enabled ? (bill.reminder_interval_days || 3) : null,
    receipt_url: bill.receipt_url || null,
    is_local: true,
  };

  // Save participants locally
  const participants: LocalBillParticipant[] = bill.participants.map((p) => ({
    id: generateLocalId(),
    bill_id: localBillId,
    phone_number: p.phone_number,
    phone_suffix: getPhoneSuffix(p.phone_number) || null,
    user_id: null,
    amount_owed: p.amount_owed,
    amount_paid: p.amount_paid || 0,
    status: p.status || "pending",
    created_at: now,
    updated_at: now,
    is_local: true,
  }));

  // CRITICAL: Must await these operations to ensure data is persisted
  // before returning. Fire-and-forget was causing data loss when network
  // state changed during creation.
  try {
    await offlineDb.bills.put(localBill);
    console.log('[Offline] Bill saved locally:', localBillId);

    await offlineDb.billParticipants.bulkPut(participants);
    console.log('[Offline] Participants saved locally:', participants.length);

    await addToSyncQueue("bill", "create", localBillId, {
      creator_id: localBill.creator_id,
      title: localBill.title,
      description: localBill.description,
      total_amount: localBill.total_amount,
      currency: localBill.currency,
      due_date: localBill.due_date,
      status: localBill.status,
      // Ensure reminder settings are explicitly passed
      reminder_enabled: localBill.reminder_enabled || false,
      reminder_interval_days: localBill.reminder_interval_days,
      receipt_url: localBill.receipt_url,
      _participants: bill.participants,
      _local_bill_id: localBillId,
    });
  } catch (e) {
    console.error('[Offline] Failed to save bill locally:', e);
    throw new Error('Failed to save bill. Please try again.');
  }

  return { ...localBill, participants };
}

export async function updateBillOfflineFirst(
  billId: string,
  updates: Partial<BillInsertOffline> & { status?: string }
): Promise<LocalBill | null> {
  const existing = await offlineDb.bills.get(billId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updatedBill: LocalBill = {
    ...existing,
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    total_amount: updates.total_amount ?? existing.total_amount,
    due_date: updates.due_date ?? existing.due_date,
    status: updates.status ?? existing.status,
    reminder_enabled: updates.reminder_enabled ?? existing.reminder_enabled,
    reminder_interval_days: updates.reminder_interval_days ?? existing.reminder_interval_days,
    updated_at: now,
    is_local: true,
  };

  await offlineDb.bills.put(updatedBill);

  await addToSyncQueue("bill", "update", billId, {
    title: updatedBill.title,
    description: updatedBill.description,
    total_amount: updatedBill.total_amount,
    due_date: updatedBill.due_date,
    status: updatedBill.status,
    reminder_enabled: updatedBill.reminder_enabled,
    reminder_interval_days: updatedBill.reminder_interval_days,
  });

  const participants = await offlineDb.billParticipants
    .where("bill_id")
    .equals(billId)
    .toArray();

  return { ...updatedBill, participants } as LocalBill & { participants: LocalBillParticipant[] };
}

export async function deleteBillOfflineFirst(billId: string): Promise<boolean> {
  const existing = await offlineDb.bills.get(billId);
  if (!existing) return false;

  const now = new Date().toISOString();
  
  // Check if this is an unsynced local bill (never made it to server)
  const isUnsyncedLocal = existing.is_local && !existing.synced_at;
  
  if (isUnsyncedLocal) {
    // For unsynced local bills, completely remove them from local DB
    // and remove any pending create operations from sync queue
    await offlineDb.bills.delete(billId);
    await offlineDb.billParticipants.where('bill_id').equals(billId).delete();
    await offlineDb.syncQueue.where('entity_id').equals(billId).delete();
    console.log('[Offline] Removed unsynced local bill:', billId);
  } else {
    // For synced bills, soft-delete and queue for server sync
    await offlineDb.bills.update(billId, { deleted_at: now, is_local: true });
    await addToSyncQueue("bill", "delete", billId, { deleted_at: now });
  }

  return true;
}

// ==================== BILL PARTICIPANTS ====================

export async function updateBillParticipantOfflineFirst(
  participantId: string,
  updates: { status?: string; amount_paid?: number; amount_owed?: number }
): Promise<LocalBillParticipant | null> {
  const existing = await offlineDb.billParticipants.get(participantId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updatedParticipant: LocalBillParticipant = {
    ...existing,
    status: updates.status ?? existing.status,
    amount_paid: updates.amount_paid ?? existing.amount_paid,
    amount_owed: updates.amount_owed ?? existing.amount_owed,
    updated_at: now,
    is_local: true,
  };

  await offlineDb.billParticipants.put(updatedParticipant);
  console.log('[Offline] Participant updated locally:', participantId);

  // Only queue if not a local-only ID (server doesn't know about it yet)
  if (!participantId.startsWith('local-')) {
    await addToSyncQueue("bill_participant", "update", participantId, {
      status: updatedParticipant.status,
      amount_paid: updatedParticipant.amount_paid,
      amount_owed: updatedParticipant.amount_owed,
    });
  }

  return updatedParticipant;
}

export async function createBillParticipantOfflineFirst(
  billId: string,
  participant: { phone_number: string; amount_owed: number }
): Promise<LocalBillParticipant> {
  const now = new Date().toISOString();
  const localId = generateLocalId();

  const localParticipant: LocalBillParticipant = {
    id: localId,
    bill_id: billId,
    phone_number: participant.phone_number,
    phone_suffix: getPhoneSuffix(participant.phone_number) || null,
    user_id: null,
    amount_owed: participant.amount_owed,
    amount_paid: 0,
    status: "pending",
    created_at: now,
    updated_at: now,
    is_local: true,
  };

  await offlineDb.billParticipants.put(localParticipant);
  console.log('[Offline] Participant created locally:', localId);

  // Only queue if bill is synced (not local)
  if (!billId.startsWith('local-')) {
    await addToSyncQueue("bill_participant", "create", localId, {
      bill_id: billId,
      phone_number: localParticipant.phone_number,
      amount_owed: localParticipant.amount_owed,
      amount_paid: 0,
      status: "pending",
    });
  }

  return localParticipant;
}

export async function deleteBillParticipantOfflineFirst(participantId: string): Promise<boolean> {
  const existing = await offlineDb.billParticipants.get(participantId);
  if (!existing) return false;

  await offlineDb.billParticipants.delete(participantId);
  console.log('[Offline] Participant deleted locally:', participantId);

  // Only queue if not a local-only ID
  if (!participantId.startsWith('local-')) {
    await addToSyncQueue("bill_participant", "delete", participantId, {});
  }

  return true;
}

// ==================== PAYMENTS ====================

export async function createPaymentOfflineFirst(payment: {
  reference_type: string;
  reference_id: string;
  payer_phone_number: string;
  payer_id?: string | null;
  amount: number;
  currency: string;
  notes?: string;
}): Promise<LocalPayment> {
  const now = new Date().toISOString();
  const localId = generateLocalId();

  const localPayment: LocalPayment = {
    id: localId,
    reference_type: payment.reference_type,
    reference_id: payment.reference_id,
    payer_phone_number: payment.payer_phone_number,
    payer_id: payment.payer_id || null,
    amount: payment.amount,
    currency: payment.currency,
    notes: payment.notes || null,
    created_at: now,
    is_local: true,
  };

  await offlineDb.payments.put(localPayment);
  console.log('[Offline] Payment saved locally:', localId);

  // Only queue if reference is synced (not local)
  if (!payment.reference_id.startsWith('local-')) {
    await addToSyncQueue("payment", "create", localId, {
      reference_type: localPayment.reference_type,
      reference_id: localPayment.reference_id,
      payer_phone_number: localPayment.payer_phone_number,
      payer_id: localPayment.payer_id,
      amount: localPayment.amount,
      currency: localPayment.currency,
      notes: localPayment.notes,
    });
  }

  return localPayment;
}

// ==================== IOUs ====================

export interface IOUInsertOffline {
  debtor_phone_number: string;
  amount: number;
  currency?: string;
  description?: string;
  due_date?: string;
  reminder_enabled?: boolean;
  reminder_interval_days?: number;
  direction?: string; // 'owed_to_me' | 'i_owe'
}

export async function fetchIOUsOfflineFirst(
  userId: string,
  phoneSuffix: string | null
): Promise<LocalIOU[]> {
  const dbReady = await isLocalDbAvailable();
  
  if (!dbReady) {
    console.log('[Offline] Local DB not available for IOUs, returning empty array');
    return [];
  }

  return safeDbOperation(async () => {
    const localIOUs = await offlineDb.ious
      .filter((iou) => {
        if (iou.deleted_at) return false;
        if (iou.creditor_id === userId) return true;
        if (iou.debtor_user_id === userId) return true;
        if (phoneSuffix && iou.debtor_phone_suffix === phoneSuffix) return true;
        return false;
      })
      .toArray();

    return localIOUs;
  }, []);
}

export async function createIOUOfflineFirst(
  userId: string,
  iou: IOUInsertOffline
): Promise<LocalIOU> {
  const dbReady = await isLocalDbAvailable();
  if (!dbReady) throw new Error('Local DB not available');

  const now = new Date().toISOString();
  const localId = generateLocalId();
  const phoneSuffix = getPhoneSuffix(iou.debtor_phone_number);

  const localIOU: LocalIOU = {
    id: localId,
    creditor_id: userId,
    debtor_phone_number: iou.debtor_phone_number,
    debtor_phone_suffix: phoneSuffix || null,
    debtor_user_id: null,
    amount: iou.amount,
    amount_paid: 0,
    currency: iou.currency || "USD",
    description: iou.description || null,
    due_date: iou.due_date || null,
    status: "pending",
    created_at: now,
    updated_at: now,
    deleted_at: null,
    // Explicitly default to false if undefined
    reminder_enabled: iou.reminder_enabled === true,
    reminder_interval_days: iou.reminder_enabled ? (iou.reminder_interval_days || 3) : null,
    direction: iou.direction || 'owed_to_me',
    is_local: true,
  };

  // CRITICAL: Must await these operations to ensure data is persisted
  try {
    await offlineDb.ious.put(localIOU);
    console.log('[Offline] IOU saved locally:', localId);

    await addToSyncQueue("iou", "create", localId, {
      creditor_id: localIOU.creditor_id,
      debtor_phone_number: localIOU.debtor_phone_number,
      amount: localIOU.amount,
      amount_paid: 0,
      currency: localIOU.currency,
      description: localIOU.description,
      due_date: localIOU.due_date,
      status: "pending",
      // Ensure reminder settings are explicitly passed
      reminder_enabled: localIOU.reminder_enabled || false,
      reminder_interval_days: localIOU.reminder_interval_days,
      direction: localIOU.direction || 'owed_to_me',
    });
  } catch (e) {
    console.error('[Offline] Failed to save IOU locally:', e);
    throw new Error('Failed to save IOU. Please try again.');
  }

  return localIOU;
}

export async function updateIOUOfflineFirst(
  iouId: string,
  updates: Partial<IOUInsertOffline> & { status?: string; amount_paid?: number }
): Promise<LocalIOU | null> {
  const existing = await offlineDb.ious.get(iouId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const phoneSuffix = updates.debtor_phone_number
    ? getPhoneSuffix(updates.debtor_phone_number)
    : existing.debtor_phone_suffix;

  const updatedIOU: LocalIOU = {
    ...existing,
    debtor_phone_number: updates.debtor_phone_number ?? existing.debtor_phone_number,
    debtor_phone_suffix: phoneSuffix || null,
    amount: updates.amount ?? existing.amount,
    amount_paid: updates.amount_paid ?? existing.amount_paid,
    description: updates.description ?? existing.description,
    due_date: updates.due_date ?? existing.due_date,
    status: updates.status ?? existing.status,
    reminder_enabled: updates.reminder_enabled ?? existing.reminder_enabled,
    reminder_interval_days: updates.reminder_interval_days ?? existing.reminder_interval_days,
    updated_at: now,
    is_local: true,
  };

  await offlineDb.ious.put(updatedIOU);
  console.log('[Offline] IOU updated locally:', iouId);

  // Only queue if not a local-only ID
  if (!iouId.startsWith('local-')) {
    await addToSyncQueue("iou", "update", iouId, {
      debtor_phone_number: updatedIOU.debtor_phone_number,
      amount: updatedIOU.amount,
      amount_paid: updatedIOU.amount_paid,
      description: updatedIOU.description,
      due_date: updatedIOU.due_date,
      status: updatedIOU.status,
      reminder_enabled: updatedIOU.reminder_enabled,
      reminder_interval_days: updatedIOU.reminder_interval_days,
    });
  }

  return updatedIOU;
}

export async function deleteIOUOfflineFirst(iouId: string): Promise<boolean> {
  const existing = await offlineDb.ious.get(iouId);
  if (!existing) return false;

  const now = new Date().toISOString();
  
  // Check if this is an unsynced local IOU (never made it to server)
  const isUnsyncedLocal = existing.is_local && !existing.synced_at;
  
  if (isUnsyncedLocal) {
    // For unsynced local IOUs, completely remove them from local DB
    // and remove any pending create operations from sync queue
    await offlineDb.ious.delete(iouId);
    await offlineDb.syncQueue.where('entity_id').equals(iouId).delete();
    console.log('[Offline] Removed unsynced local IOU:', iouId);
  } else {
    // For synced IOUs, soft-delete and queue for server sync
    await offlineDb.ious.update(iouId, { deleted_at: now, is_local: true });
    await addToSyncQueue("iou", "delete", iouId, { deleted_at: now });
  }

  return true;
}

// ==================== SYNC HELPERS ====================

export async function syncBillToServer(bill: LocalBill): Promise<string | null> {
  if (!isOnline()) return null;

  try {
    const { data, error } = await supabase
      .from("bills")
      .insert({
        creator_id: bill.creator_id,
        title: bill.title,
        description: bill.description,
        total_amount: bill.total_amount,
        currency: bill.currency,
        due_date: bill.due_date,
        reminder_enabled: bill.reminder_enabled,
        reminder_interval_days: bill.reminder_interval_days,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (e) {
    console.error("[Offline] Failed to sync bill to server:", e);
    return null;
  }
}

export async function syncIOUToServer(iou: LocalIOU): Promise<string | null> {
  if (!isOnline()) return null;

  try {
    const { data, error } = await supabase
      .from("ious")
      .insert({
        creditor_id: iou.creditor_id,
        debtor_phone_number: iou.debtor_phone_number,
        amount: iou.amount,
        amount_paid: 0,
        currency: iou.currency,
        description: iou.description,
        due_date: iou.due_date,
        status: "pending",
        reminder_enabled: iou.reminder_enabled,
        reminder_interval_days: iou.reminder_interval_days,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (e) {
    console.error("[Offline] Failed to sync IOU to server:", e);
    return null;
  }
}