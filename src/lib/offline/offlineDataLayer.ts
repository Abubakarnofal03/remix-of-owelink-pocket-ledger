import { supabase } from "@/integrations/supabase/client";
import { offlineDb, generateLocalId, LocalBill, LocalBillParticipant, LocalIOU } from "./db";
import { addToSyncQueue } from "./syncQueue";
import { getPhoneSuffix } from "@/lib/notifications";

// Check if we're online
export const isOnline = () => navigator.onLine;

// ==================== BILLS ====================

export interface BillInsertOffline {
  title: string;
  description?: string;
  total_amount: number;
  currency?: string;
  due_date?: string;
  participants: {
    phone_number: string;
    amount_owed: number;
    status?: string;
    amount_paid?: number;
  }[];
}

export async function fetchBillsOfflineFirst(userId: string): Promise<LocalBill[]> {
  // Always return local data first (instant)
  const localBills = await offlineDb.bills
    .filter(b => !b.deleted_at)
    .toArray();

  // Include participants
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
}

export async function createBillOfflineFirst(
  userId: string,
  bill: BillInsertOffline
): Promise<LocalBill> {
  const now = new Date().toISOString();
  const localId = generateLocalId();
  const currency = bill.currency || "USD";

  const localBill: LocalBill = {
    id: localId,
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
    is_local: true,
  };

  // Save bill to local DB
  await offlineDb.bills.put(localBill);

  // Save participants
  const participants: LocalBillParticipant[] = bill.participants.map((p) => ({
    id: generateLocalId(),
    bill_id: localId,
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

  await offlineDb.billParticipants.bulkPut(participants);

  // Add to sync queue
  await addToSyncQueue("bill", "create", localId, {
    ...localBill,
    participants: bill.participants,
  } as unknown as Record<string, unknown>);

  return { ...localBill, participants } as LocalBill & { participants: LocalBillParticipant[] };
}

export async function updateBillOfflineFirst(
  billId: string,
  updates: Partial<BillInsertOffline>
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
    updated_at: now,
    is_local: true,
  };

  await offlineDb.bills.put(updatedBill);

  // Add to sync queue
  await addToSyncQueue("bill", "update", billId, {
    title: updatedBill.title,
    description: updatedBill.description,
    total_amount: updatedBill.total_amount,
    due_date: updatedBill.due_date,
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
  await offlineDb.bills.update(billId, { deleted_at: now, is_local: true });

  // Add to sync queue
  await addToSyncQueue("bill", "delete", billId, { deleted_at: now });

  return true;
}

// ==================== IOUs ====================

export interface IOUInsertOffline {
  debtor_phone_number: string;
  amount: number;
  currency?: string;
  description?: string;
  due_date?: string;
}

export async function fetchIOUsOfflineFirst(
  userId: string,
  phoneSuffix: string | null
): Promise<LocalIOU[]> {
  // Get all local IOUs
  const localIOUs = await offlineDb.ious
    .filter((iou) => {
      if (iou.deleted_at) return false;
      // Show IOUs where user is creditor or debtor
      if (iou.creditor_id === userId) return true;
      if (iou.debtor_user_id === userId) return true;
      if (phoneSuffix && iou.debtor_phone_suffix === phoneSuffix) return true;
      return false;
    })
    .toArray();

  return localIOUs;
}

export async function createIOUOfflineFirst(
  userId: string,
  iou: IOUInsertOffline
): Promise<LocalIOU> {
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
    is_local: true,
  };

  // Save to local DB
  await offlineDb.ious.put(localIOU);

  // Add to sync queue
  await addToSyncQueue("iou", "create", localId, localIOU as unknown as Record<string, unknown>);

  return localIOU;
}

export async function updateIOUOfflineFirst(
  iouId: string,
  updates: Partial<IOUInsertOffline>
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
    description: updates.description ?? existing.description,
    due_date: updates.due_date ?? existing.due_date,
    updated_at: now,
    is_local: true,
  };

  await offlineDb.ious.put(updatedIOU);

  // Add to sync queue
  await addToSyncQueue("iou", "update", iouId, {
    debtor_phone_number: updatedIOU.debtor_phone_number,
    amount: updatedIOU.amount,
    description: updatedIOU.description,
    due_date: updatedIOU.due_date,
  });

  return updatedIOU;
}

export async function deleteIOUOfflineFirst(iouId: string): Promise<boolean> {
  const existing = await offlineDb.ious.get(iouId);
  if (!existing) return false;

  const now = new Date().toISOString();
  await offlineDb.ious.update(iouId, { deleted_at: now, is_local: true });

  // Add to sync queue
  await addToSyncQueue("iou", "delete", iouId, { deleted_at: now });

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
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (e) {
    console.error("Failed to sync bill to server:", e);
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
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (e) {
    console.error("Failed to sync IOU to server:", e);
    return null;
  }
}
