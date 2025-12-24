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
}

// Process a single sync queue item
async function processSyncItem(item: SyncQueueItem): Promise<boolean> {
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
    }

    if (success) {
      await offlineDb.syncQueue.delete(item.id!);
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

    console.error(`Sync failed for ${item.entity_type}:${item.entity_id}`, error);
    return false;
  }
}

// Sync bill operations
async function syncBill(item: SyncQueueItem): Promise<boolean> {
  const { operation, entity_id, payload } = item;

  switch (operation) {
    case 'create': {
      // For create, we need to handle local ID replacement
      const localId = entity_id;
      const { id: _, is_local: __, synced_at: ___, ...billData } = payload as Record<string, unknown>;
      
      const { data, error } = await supabase
        .from('bills')
        .insert(billData as any)
        .select()
        .single();

      if (error) throw error;

      // Update local record with server ID
      if (data && localId.startsWith('local-')) {
        await offlineDb.bills.delete(localId);
        await offlineDb.bills.put({
          ...data,
          synced_at: Date.now(),
          is_local: false,
        });
        
        // Update any participants with the new bill ID
        const localParticipants = await offlineDb.billParticipants
          .where('bill_id')
          .equals(localId)
          .toArray();
        
        for (const p of localParticipants) {
          await offlineDb.billParticipants.update(p.id, { bill_id: data.id });
        }
      }
      return true;
    }

    case 'update': {
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload as Record<string, unknown>;
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
      const { id: _, is_local: __, synced_at: ___, ...data } = payload as Record<string, unknown>;
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
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload as Record<string, unknown>;
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
      const { id: _, is_local: __, synced_at: ___, ...data } = payload as Record<string, unknown>;
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
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload as Record<string, unknown>;
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
    const { id: _, is_local: __, synced_at: ___, ...data } = payload as Record<string, unknown>;
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
      const { id: _, is_local: __, synced_at: ___, ...data } = payload as Record<string, unknown>;
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
      const { id: _, is_local: __, synced_at: ___, ...updateData } = payload as Record<string, unknown>;
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
    const { id: _, synced_at: __, ...updateData } = payload as Record<string, unknown>;
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

// Process all pending sync items
export async function processAllPendingSync(): Promise<{ processed: number; failed: number }> {
  const pendingItems = await offlineDb.syncQueue
    .where('status')
    .anyOf(['pending', 'failed'])
    .filter(item => item.retry_count < MAX_RETRY_COUNT)
    .sortBy('created_at');

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    // Apply exponential backoff for retries
    if (item.retry_count > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, item.retry_count);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const success = await processSyncItem(item);
    if (success) {
      processed++;
    } else {
      failed++;
    }
  }

  return { processed, failed };
}

// Get failed sync items count
export async function getFailedSyncCount(): Promise<number> {
  return offlineDb.syncQueue
    .where('status')
    .equals('failed')
    .count();
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
