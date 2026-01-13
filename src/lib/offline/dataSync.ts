import { supabase } from '@/integrations/supabase/client';
import { offlineDb, LocalBill, LocalBillParticipant, LocalIOU, LocalContact, LocalPayment, LocalNotification, LocalPaymentRequest, LocalIOUPaymentRequest } from './db';

// Fetch and store bills from server (with creator profile info for participants)
export async function syncBillsFromServer(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        participants:bill_participants(*)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data) {
      const now = Date.now();
      
      // Collect unique creator IDs
      const creatorIds = [...new Set(data.map(bill => bill.creator_id))];
      
      // Fetch creator profiles in batch
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, username, phone_number')
        .in('user_id', creatorIds);
      
      // Create a map for quick lookup
      const profileMap = new Map<string, { username: string; phone_number: string }>();
      profilesData?.forEach(p => {
        profileMap.set(p.user_id, { username: p.username, phone_number: p.phone_number });
      });
      
      // Store bills with creator info
      const bills: LocalBill[] = data.map(bill => {
        const creatorProfile = profileMap.get(bill.creator_id);
        return {
          id: bill.id,
          creator_id: bill.creator_id,
          title: bill.title,
          description: bill.description,
          total_amount: bill.total_amount,
          currency: bill.currency,
          status: bill.status,
          due_date: bill.due_date,
          created_at: bill.created_at,
          updated_at: bill.updated_at,
          deleted_at: bill.deleted_at,
          reminder_enabled: bill.reminder_enabled,
          reminder_interval_days: bill.reminder_interval_days,
          synced_at: now,
          is_local: false,
          // Creator info from profile lookup
          creator_username: creatorProfile?.username || null,
          creator_phone_number: creatorProfile?.phone_number || null,
        };
      });

      // Store participants
      const participants: LocalBillParticipant[] = data.flatMap(bill =>
        (bill.participants || []).map((p: any) => ({
          id: p.id,
          bill_id: p.bill_id,
          phone_number: p.phone_number,
          phone_suffix: p.phone_suffix,
          user_id: p.user_id,
          amount_owed: p.amount_owed,
          amount_paid: p.amount_paid,
          status: p.status,
          created_at: p.created_at,
          updated_at: p.updated_at,
          synced_at: now,
          is_local: false,
        }))
      );

      // Clear existing synced bills and participants, keeping local ones
      const localBills = await offlineDb.bills.filter(b => b.is_local === true).toArray();
      const localParticipants = await offlineDb.billParticipants.filter(p => p.is_local === true).toArray();
      
      await offlineDb.bills.clear();
      await offlineDb.billParticipants.clear();
      
      // Put all data back
      await offlineDb.bills.bulkPut([...bills, ...localBills]);
      await offlineDb.billParticipants.bulkPut([...participants, ...localParticipants]);
    }
  } catch (error) {
    console.error('Error syncing bills from server:', error);
    throw error;
  }
}

// Fetch and store IOUs from server (with creditor profile info for debtors)
export async function syncIOUsFromServer(userId: string, phoneSuffix: string | null): Promise<void> {
  try {
    // Fetch IOUs
    const { data: iousData, error: iousError } = await supabase
      .from('ious')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (iousError) throw iousError;

    if (iousData) {
      const now = Date.now();
      
      // Collect unique creditor IDs
      const creditorIds = [...new Set(iousData.map(iou => iou.creditor_id))];
      
      // Fetch creditor profiles in batch
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, username, phone_number')
        .in('user_id', creditorIds);
      
      // Create a map for quick lookup
      const profileMap = new Map<string, { username: string; phone_number: string }>();
      profilesData?.forEach(p => {
        profileMap.set(p.user_id, { username: p.username, phone_number: p.phone_number });
      });
      
      const ious: LocalIOU[] = iousData.map(iou => {
        const creditorProfile = profileMap.get(iou.creditor_id);
        return {
          id: iou.id,
          creditor_id: iou.creditor_id,
          debtor_phone_number: iou.debtor_phone_number,
          debtor_phone_suffix: iou.debtor_phone_suffix,
          debtor_user_id: iou.debtor_user_id,
          amount: iou.amount,
          amount_paid: iou.amount_paid,
          currency: iou.currency,
          description: iou.description,
          due_date: iou.due_date,
          status: iou.status,
          created_at: iou.created_at,
          updated_at: iou.updated_at,
          deleted_at: iou.deleted_at,
          synced_at: now,
          is_local: false,
          // Creditor info from profile lookup
          creditor_username: creditorProfile?.username || null,
          creditor_phone_number: creditorProfile?.phone_number || null,
        };
      });

      // Preserve local IOUs
      const localIOUs = await offlineDb.ious.filter(i => i.is_local === true).toArray();
      
      await offlineDb.ious.clear();
      await offlineDb.ious.bulkPut([...ious, ...localIOUs]);
    }
  } catch (error) {
    console.error('Error syncing IOUs from server:', error);
    throw error;
  }
}

// Fetch and store contacts from server
export async function syncContactsFromServer(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('nickname', { ascending: true });

    if (error) throw error;

    if (data) {
      const now = Date.now();
      
      const contacts: LocalContact[] = data.map(contact => ({
        id: contact.id,
        user_id: contact.user_id,
        phone_number: contact.phone_number,
        phone_suffix: contact.phone_suffix,
        nickname: contact.nickname,
        linked_profile_id: contact.linked_profile_id,
        created_at: contact.created_at,
        updated_at: contact.updated_at,
        synced_at: now,
        is_local: false,
      }));

      // Preserve local contacts
      const localContacts = await offlineDb.contacts.filter(c => c.is_local === true).toArray();
      
      await offlineDb.contacts.clear();
      await offlineDb.contacts.bulkPut([...contacts, ...localContacts]);
    }
  } catch (error) {
    console.error('Error syncing contacts from server:', error);
    throw error;
  }
}

// Fetch and store payments from server
export async function syncPaymentsFromServer(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (data) {
      const now = Date.now();
      
      const payments: LocalPayment[] = data.map(payment => ({
        id: payment.id,
        reference_type: payment.reference_type,
        reference_id: payment.reference_id,
        payer_phone_number: payment.payer_phone_number,
        payer_id: payment.payer_id,
        amount: payment.amount,
        currency: payment.currency,
        notes: payment.notes,
        created_at: payment.created_at,
        synced_at: now,
        is_local: false,
      }));

      // Preserve local payments
      const localPayments = await offlineDb.payments.filter(p => p.is_local === true).toArray();
      
      await offlineDb.payments.clear();
      await offlineDb.payments.bulkPut([...payments, ...localPayments]);
    }
  } catch (error) {
    console.error('Error syncing payments from server:', error);
    throw error;
  }
}

// Fetch and store notifications from server
export async function syncNotificationsFromServer(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (data) {
      const now = Date.now();
      
      const notifications: LocalNotification[] = data.map(notification => ({
        id: notification.id,
        user_id: notification.user_id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        read: notification.read,
        reference_type: notification.reference_type,
        reference_id: notification.reference_id,
        created_at: notification.created_at,
        synced_at: now,
      }));

      await offlineDb.notifications.clear();
      await offlineDb.notifications.bulkPut(notifications);
    }
  } catch (error) {
    console.error('Error syncing notifications from server:', error);
    throw error;
  }
}

// Fetch and store payment requests from server
export async function syncPaymentRequestsFromServer(userId: string): Promise<void> {
  try {
    // Get bills where user is creator to get their payment requests
    const { data: bills } = await supabase
      .from('bills')
      .select('id')
      .eq('creator_id', userId);

    if (!bills || bills.length === 0) return;

    const billIds = bills.map(b => b.id);
    
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .in('bill_id', billIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data) {
      const now = Date.now();
      
      const requests: LocalPaymentRequest[] = data.map(req => ({
        id: req.id,
        bill_id: req.bill_id,
        participant_id: req.participant_id,
        requester_phone_suffix: req.requester_phone_suffix,
        amount_claimed: req.amount_claimed,
        receipt_url: req.receipt_url,
        status: req.status,
        message: req.message,
        creator_response: req.creator_response,
        created_at: req.created_at,
        updated_at: req.updated_at,
        synced_at: now,
        is_local: false,
      }));

      // Preserve local requests
      const localRequests = await offlineDb.paymentRequests.filter(r => r.is_local === true).toArray();
      
      await offlineDb.paymentRequests.clear();
      await offlineDb.paymentRequests.bulkPut([...requests, ...localRequests]);
    }
  } catch (error) {
    console.error('Error syncing payment requests from server:', error);
    throw error;
  }
}

// Fetch and store IOU payment requests from server
export async function syncIOUPaymentRequestsFromServer(userId: string): Promise<void> {
  try {
    // Get IOUs where user is creditor to get their payment requests
    const { data: ious } = await supabase
      .from('ious')
      .select('id')
      .eq('creditor_id', userId);

    if (!ious || ious.length === 0) return;

    const iouIds = ious.map(i => i.id);
    
    const { data, error } = await supabase
      .from('iou_payment_requests')
      .select('*')
      .in('iou_id', iouIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data) {
      const now = Date.now();
      
      const requests: LocalIOUPaymentRequest[] = data.map(req => ({
        id: req.id,
        iou_id: req.iou_id,
        requester_phone_suffix: req.requester_phone_suffix,
        amount_claimed: req.amount_claimed,
        receipt_url: req.receipt_url,
        status: req.status,
        message: req.message,
        creator_response: req.creator_response,
        created_at: req.created_at,
        updated_at: req.updated_at,
        synced_at: now,
        is_local: false,
      }));

      // Preserve local requests
      const localRequests = await offlineDb.iouPaymentRequests.filter(r => r.is_local === true).toArray();
      
      await offlineDb.iouPaymentRequests.clear();
      await offlineDb.iouPaymentRequests.bulkPut([...requests, ...localRequests]);
    }
  } catch (error) {
    console.error('Error syncing IOU payment requests from server:', error);
    throw error;
  }
}

// Full sync - fetch all data from server
export async function performFullSync(userId: string, phoneSuffix: string | null): Promise<void> {
  await Promise.all([
    syncBillsFromServer(userId),
    syncIOUsFromServer(userId, phoneSuffix),
    syncContactsFromServer(userId),
    syncPaymentsFromServer(userId),
    syncNotificationsFromServer(userId),
    syncPaymentRequestsFromServer(userId),
    syncIOUPaymentRequestsFromServer(userId),
  ]);
  
  // Update sync metadata
  await offlineDb.syncMetadata.bulkPut([
    { id: 'bills', entity_type: 'bills', last_synced_at: Date.now(), last_server_timestamp: null },
    { id: 'ious', entity_type: 'ious', last_synced_at: Date.now(), last_server_timestamp: null },
    { id: 'contacts', entity_type: 'contacts', last_synced_at: Date.now(), last_server_timestamp: null },
    { id: 'payments', entity_type: 'payments', last_synced_at: Date.now(), last_server_timestamp: null },
    { id: 'notifications', entity_type: 'notifications', last_synced_at: Date.now(), last_server_timestamp: null },
    { id: 'payment_requests', entity_type: 'payment_requests', last_synced_at: Date.now(), last_server_timestamp: null },
    { id: 'iou_payment_requests', entity_type: 'iou_payment_requests', last_synced_at: Date.now(), last_server_timestamp: null },
  ]);
}
