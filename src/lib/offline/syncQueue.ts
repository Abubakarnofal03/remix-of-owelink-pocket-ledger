import { offlineDb, SyncQueueItem, generateActionId } from './db';
import { supabase } from '@/integrations/supabase/client';

const MAX_RETRY_COUNT = 5;
const BASE_DELAY_MS = 1000;

// Add action to sync queue
export async function addToSyncQueue(
  entityType: SyncQueueItem['entity_type'],
  operation: SyncQueueItem['operation'],
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const ready = await offlineDb.ensureReady();
    if (!ready) return;

    // De-dupe: keep a single queued action per entity (merge payloads)
    const existingItems = await offlineDb.syncQueue
      .where('entity_id')
      .equals(entityId)
      .filter(i => i.entity_type === entityType)
      .toArray();

    const existing = existingItems[0];

    // Delete supersedes everything
    if (operation === 'delete') {
      if (existingItems.length > 0) {
        await Promise.all(existingItems.map(i => offlineDb.syncQueue.delete(i.id!)));
      }
      await offlineDb.syncQueue.add({
        action_id: generateActionId(),
        entity_type: entityType,
        operation,
        entity_id: entityId,
        payload,
        created_at: Date.now(),
        retry_count: 0,
        last_error: null,
        status: 'pending',
      });
      console.log(`[SyncQueue] Added: ${entityType}:${operation}:${entityId}`);
      return;
    }

    if (existing) {
      // If a create is queued and we later update, fold update into the create payload
      const nextOperation = existing.operation === 'create' ? 'create' : operation;
      const mergedPayload = { ...(existing.payload || {}), ...(payload || {}) };

      await offlineDb.syncQueue.update(existing.id!, {
        action_id: generateActionId(),
        operation: nextOperation,
        payload: mergedPayload,
        created_at: Date.now(),
        retry_count: 0,
        last_error: null,
        status: 'pending',
      });
      console.log(`[SyncQueue] Updated: ${entityType}:${nextOperation}:${entityId}`);
      return;
    }

    await offlineDb.syncQueue.add({
      action_id: generateActionId(),
      entity_type: entityType,
      operation,
      entity_id: entityId,
      payload,
      created_at: Date.now(),
      retry_count: 0,
      last_error: null,
      status: 'pending',
    });
    console.log(`[SyncQueue] Added: ${entityType}:${operation}:${entityId}`);
  } catch (e) {
    console.error('[SyncQueue] Failed to add item:', e);
  }
}

// Process a single sync queue item
export async function processSyncItem(item: SyncQueueItem): Promise<boolean> {
  try {
    await offlineDb.syncQueue.update(item.id!, { status: 'processing' });

    let success = false;

    switch (item.entity_type) {
      case 'bill':
        success = await syncBill(item);
        break;
      case 'bill_participant':
        success = await syncBillParticipant(item);
        break;
      case 'iou':
        success = await syncIOU(item);
        break;
      case 'payment':
        success = await syncPayment(item);
        break;
      case 'contact':
        success = await syncContact(item);
        break;
      case 'notification':
        success = await syncNotification(item);
        break;
      case 'payment_request':
        success = await syncPaymentRequest(item);
        break;
      case 'iou_payment_request':
        success = await syncIOUPaymentRequest(item);
        break;
    }

    if (success) {
      await offlineDb.syncQueue.delete(item.id!);
      console.log(`[SyncQueue] ✓ Synced: ${item.entity_type}:${item.operation}:${item.entity_id}`);
      return true;
    }

    throw new Error('Sync operation returned false');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newRetryCount = item.retry_count + 1;

    if (newRetryCount >= MAX_RETRY_COUNT) {
      await offlineDb.syncQueue.update(item.id!, {
        status: 'failed',
        retry_count: newRetryCount,
        last_error: errorMessage,
      });
    } else {
      await offlineDb.syncQueue.update(item.id!, {
        status: 'pending',
        retry_count: newRetryCount,
        last_error: errorMessage,
      });
    }

    console.error(`[SyncQueue] ✗ Failed: ${item.entity_type}:${item.entity_id}`, error);
    return false;
  }
}

// Sync bill operations
async function syncBill(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  switch (operation) {
    case 'create': {
      const localId = entity_id;
      const participants = payload._participants as Array<{
        phone_number: string;
        amount_owed: number;
        status?: string;
        amount_paid?: number;
      }> | undefined;
      
      // Remove internal fields from payload
      const { _participants, _local_bill_id, id: _, is_local: __, synced_at: ___, ...billData } = payload;
      
      // Step 1: Create bill on server
      const { data: serverBill, error } = await supabase
        .from('bills')
        .insert(billData as any)
        .select()
        .single();

      if (error) throw error;
      if (!serverBill) throw new Error('No bill returned from server');

      console.log(`[SyncQueue] Bill created on server: ${serverBill.id}`);

      // Step 2: Create participants on server
      if (participants && participants.length > 0) {
        const participantsToInsert = participants.map(p => ({
          bill_id: serverBill.id,
          phone_number: p.phone_number,
          amount_owed: p.amount_owed,
          amount_paid: p.amount_paid || 0,
          status: p.status || 'pending',
        }));

        const { data: serverParticipants, error: pError } = await supabase
          .from('bill_participants')
          .insert(participantsToInsert)
          .select();

        if (pError) {
          console.error('[SyncQueue] Failed to create participants:', pError);
          // Don't fail the whole operation, bill is created
        } else {
          console.log(`[SyncQueue] Created ${serverParticipants?.length || 0} participants`);
          
          // Update local participants with server IDs
          const localParticipants = await offlineDb.billParticipants
            .where('bill_id')
            .equals(localId)
            .toArray();
          
          for (let i = 0; i < localParticipants.length; i++) {
            const localP = localParticipants[i];
            const serverP = serverParticipants?.find(sp => sp.phone_number === localP.phone_number);
            
            if (serverP) {
              await offlineDb.billParticipants.delete(localP.id);
              await offlineDb.billParticipants.put({
                ...serverP,
                synced_at: Date.now(),
                is_local: false,
              });
            }
          }
        }
      }

      // Step 3: Update local bill with server ID
      await offlineDb.bills.delete(localId);
      await offlineDb.bills.put({
        ...serverBill,
        synced_at: Date.now(),
        is_local: false,
      });

      return true;
    }

    case 'update': {
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload;
      const { error } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.bills.update(entity_id, { synced_at: Date.now(), is_local: false });
      return true;
    }

    case 'delete': {
      const { error } = await supabase
        .from('bills')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.bills.delete(entity_id);
      return true;
    }
  }

  return false;
}

// Sync bill participant operations
async function syncBillParticipant(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  switch (operation) {
    case 'create': {
      const { id: _, is_local: __, synced_at: ___, ...data } = payload;
      const { data: result, error } = await supabase
        .from('bill_participants')
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      
      if (result && entity_id.startsWith('local-')) {
        await offlineDb.billParticipants.delete(entity_id);
        await offlineDb.billParticipants.put({
          ...result,
          synced_at: Date.now(),
          is_local: false,
        });
      }
      return true;
    }

    case 'update': {
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload;
      const { error } = await supabase
        .from('bill_participants')
        .update(updateData)
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.billParticipants.update(entity_id, { synced_at: Date.now(), is_local: false });
      return true;
    }

    case 'delete': {
      const { error } = await supabase
        .from('bill_participants')
        .delete()
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.billParticipants.delete(entity_id);
      return true;
    }
  }

  return false;
}

// Sync IOU operations
async function syncIOU(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  switch (operation) {
    case 'create': {
      const { id: _, is_local: __, synced_at: ___, ...data } = payload;
      const { data: result, error } = await supabase
        .from('ious')
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      
      if (result && entity_id.startsWith('local-')) {
        await offlineDb.ious.delete(entity_id);
        await offlineDb.ious.put({
          ...result,
          synced_at: Date.now(),
          is_local: false,
        });
      }
      return true;
    }

    case 'update': {
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload;
      const { error } = await supabase
        .from('ious')
        .update(updateData)
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.ious.update(entity_id, { synced_at: Date.now(), is_local: false });
      return true;
    }

    case 'delete': {
      const { error } = await supabase
        .from('ious')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.ious.delete(entity_id);
      return true;
    }
  }

  return false;
}

// Sync payment operations
async function syncPayment(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  if (operation === 'create') {
    const { id: _, is_local: __, synced_at: ___, ...data } = payload;
    const { data: result, error } = await supabase
      .from('payments')
      .insert(data as any)
      .select()
      .single();

    if (error) throw error;
    
    if (result && entity_id.startsWith('local-')) {
      await offlineDb.payments.delete(entity_id);
      await offlineDb.payments.put({
        ...result,
        synced_at: Date.now(),
        is_local: false,
      });
    }
    return true;
  }

  return false;
}

// Sync contact operations
async function syncContact(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  switch (operation) {
    case 'create': {
      const { id: _, is_local: __, synced_at: ___, ...data } = payload;
      const { data: result, error } = await supabase
        .from('contacts')
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      
      if (result && entity_id.startsWith('local-')) {
        await offlineDb.contacts.delete(entity_id);
        await offlineDb.contacts.put({
          ...result,
          synced_at: Date.now(),
          is_local: false,
        });
      }
      return true;
    }

    case 'update': {
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload;
      const { error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.contacts.update(entity_id, { synced_at: Date.now(), is_local: false });
      return true;
    }

    case 'delete': {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.contacts.delete(entity_id);
      return true;
    }
  }

  return false;
}

// Sync notification operations
async function syncNotification(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  if (operation === 'update') {
    const { id: _, synced_at: __, ...updateData } = payload;
    const { error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', entity_id);

    if (error) throw error;
    
    await offlineDb.notifications.update(entity_id, { synced_at: Date.now() });
    return true;
  }

  return false;
}

// Sync payment request operations
async function syncPaymentRequest(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  switch (operation) {
    case 'create': {
      const { id: _, is_local: __, synced_at: ___, ...data } = payload;
      const { data: result, error } = await supabase
        .from('payment_requests')
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      
      if (result && entity_id.startsWith('local-')) {
        await offlineDb.paymentRequests.delete(entity_id);
        await offlineDb.paymentRequests.put({
          ...result,
          synced_at: Date.now(),
          is_local: false,
        });
      }
      return true;
    }

    case 'update': {
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload;
      const { error } = await supabase
        .from('payment_requests')
        .update(updateData)
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.paymentRequests.update(entity_id, { synced_at: Date.now(), is_local: false });
      return true;
    }
  }

  return false;
}

// Sync IOU payment request operations
async function syncIOUPaymentRequest(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  switch (operation) {
    case 'create': {
      const { id: _, is_local: __, synced_at: ___, ...data } = payload;
      const { data: result, error } = await supabase
        .from('iou_payment_requests')
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      
      if (result && entity_id.startsWith('local-')) {
        await offlineDb.iouPaymentRequests.delete(entity_id);
        await offlineDb.iouPaymentRequests.put({
          ...result,
          synced_at: Date.now(),
          is_local: false,
        });
      }
      return true;
    }

    case 'update': {
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload;
      const { error } = await supabase
        .from('iou_payment_requests')
        .update(updateData)
        .eq('id', entity_id);

      if (error) throw error;
      
      await offlineDb.iouPaymentRequests.update(entity_id, { synced_at: Date.now(), is_local: false });
      return true;
    }
  }

  return false;
}

// Process all pending sync items
export async function processAllPendingSync(): Promise<{ processed: number; failed: number }> {
  if (!navigator.onLine) {
    console.log('[SyncQueue] Offline, skipping sync');
    return { processed: 0, failed: 0 };
  }

  const ready = await offlineDb.ensureReady();
  if (!ready) {
    console.log('[SyncQueue] DB not ready, skipping sync');
    return { processed: 0, failed: 0 };
  }

  const pendingItems = await offlineDb.syncQueue
    .where('status')
    .anyOf(['pending', 'failed'])
    .filter(item => item.retry_count < MAX_RETRY_COUNT)
    .sortBy('created_at');

  if (pendingItems.length === 0) {
    return { processed: 0, failed: 0 };
  }

  console.log(`[SyncQueue] Processing ${pendingItems.length} items...`);

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    // Apply exponential backoff for retries
    if (item.retry_count > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, item.retry_count - 1);
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10000)));
    }

    const success = await processSyncItem(item);
    if (success) {
      processed++;
    } else {
      failed++;
    }
  }

  console.log(`[SyncQueue] Done: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

// Get failed sync items count
export async function getFailedSyncCount(): Promise<number> {
  try {
    return await offlineDb.syncQueue
      .where('status')
      .equals('failed')
      .count();
  } catch {
    return 0;
  }
}

// Retry all failed items
export async function retryFailedItems(): Promise<void> {
  await offlineDb.syncQueue
    .where('status')
    .equals('failed')
    .modify({ status: 'pending', retry_count: 0, last_error: null });
}

// Clear completed/old items
export async function clearOldSyncItems(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  const threshold = Date.now() - olderThanMs;
  await offlineDb.syncQueue
    .where('created_at')
    .below(threshold)
    .and(item => item.status === 'failed' && item.retry_count >= MAX_RETRY_COUNT)
    .delete();
}
