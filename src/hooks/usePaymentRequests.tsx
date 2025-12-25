import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPhoneSuffix, sendPushNotification } from '@/lib/notifications';
import { offlineDb, generateLocalId, LocalPaymentRequest } from '@/lib/offline/db';
import { addToSyncQueue } from '@/lib/offline/syncQueue';

export interface PaymentRequest {
  id: string;
  bill_id: string;
  participant_id: string;
  requester_phone_suffix: string;
  amount_claimed: number;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  creator_response: string | null;
  created_at: string;
  updated_at: string;
}

interface UsePaymentRequestsReturn {
  requests: PaymentRequest[];
  loading: boolean;
  createRequest: (data: CreateRequestData) => Promise<boolean>;
  updateRequestStatus: (requestId: string, status: 'approved' | 'rejected', response?: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

interface CreateRequestData {
  bill_id: string;
  participant_id: string;
  amount_claimed: number;
  receipt_url?: string;
  message?: string;
}

export function usePaymentRequests(billId: string | undefined): UsePaymentRequestsReturn {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!billId || !user) {
      setLoading(false);
      return;
    }

    try {
      // Try to get from local DB first
      const dbReady = await offlineDb.ensureReady();
      if (dbReady) {
        const localRequests = await offlineDb.paymentRequests
          .where('bill_id')
          .equals(billId)
          .toArray();
        
        if (localRequests.length > 0) {
          setRequests(localRequests.map(r => ({
            ...r,
            status: r.status as 'pending' | 'approved' | 'rejected',
          })));
        }
      }

      // If online, fetch from server
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('bill_id', billId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const serverRequests = (data || []) as PaymentRequest[];
        setRequests(serverRequests);

        // Update local DB
        if (dbReady && data) {
          const now = Date.now();
          for (const req of data) {
            await offlineDb.paymentRequests.put({
              ...req,
              synced_at: now,
              is_local: false,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching payment requests:', error);
    } finally {
      setLoading(false);
    }
  }, [billId, user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (data: CreateRequestData): Promise<boolean> => {
    if (!user || !profile) {
      toast.error('You must be logged in to request a status change');
      return false;
    }

    const phoneSuffix = profile.phone_suffix || getPhoneSuffix(profile.phone_number);
    if (!phoneSuffix) {
      toast.error('Unable to determine your phone number');
      return false;
    }

    const now = new Date().toISOString();
    const localId = generateLocalId();
    
    const newRequest: LocalPaymentRequest = {
      id: localId,
      bill_id: data.bill_id,
      participant_id: data.participant_id,
      requester_phone_suffix: phoneSuffix,
      amount_claimed: data.amount_claimed,
      receipt_url: data.receipt_url || null,
      message: data.message || null,
      status: 'pending',
      creator_response: null,
      created_at: now,
      updated_at: now,
      is_local: true,
    };

    try {
      // Save to local DB first
      const dbReady = await offlineDb.ensureReady();
      if (dbReady) {
        await offlineDb.paymentRequests.put(newRequest);
      }

      // Add to local state
      setRequests(prev => [newRequest as PaymentRequest, ...prev]);

      if (navigator.onLine) {
        // Try to sync immediately
        const { data: serverRequest, error } = await supabase
          .from('payment_requests')
          .insert({
            bill_id: data.bill_id,
            participant_id: data.participant_id,
            requester_phone_suffix: phoneSuffix,
            amount_claimed: data.amount_claimed,
            receipt_url: data.receipt_url || null,
            message: data.message || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Update local DB with server data
        if (dbReady) {
          await offlineDb.paymentRequests.delete(localId);
          await offlineDb.paymentRequests.put({
            ...serverRequest,
            synced_at: Date.now(),
            is_local: false,
          });
        }

        // Update state with server data
        setRequests(prev => 
          prev.map(r => r.id === localId ? serverRequest as PaymentRequest : r)
        );

        // Send notification to creator
        const { data: bill } = await supabase
          .from('bills')
          .select('creator_id, title')
          .eq('id', data.bill_id)
          .single();

        if (bill) {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('phone_suffix')
            .eq('user_id', bill.creator_id)
            .single();

          if (creatorProfile?.phone_suffix) {
            await sendPushNotification({
              phoneSuffixes: [creatorProfile.phone_suffix],
              title: 'Payment Confirmation Request',
              body: `Someone has requested payment confirmation for "${bill.title}"`,
              data: { type: 'bill', id: data.bill_id },
            });
          }
        }
      } else {
        // Queue for sync when offline
        await addToSyncQueue('payment_request', 'create', localId, newRequest as unknown as Record<string, unknown>);
      }

      toast.success('Payment confirmation request sent');
      return true;
    } catch (error) {
      console.error('Error creating payment request:', error);
      // If online sync failed, queue for later
      await addToSyncQueue('payment_request', 'create', localId, newRequest as unknown as Record<string, unknown>);
      toast.success('Request saved, will sync when online');
      return true;
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: 'approved' | 'rejected',
    response?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const updateData = {
        status,
        creator_response: response || null,
        updated_at: new Date().toISOString(),
      };

      // Update local DB first
      const dbReady = await offlineDb.ensureReady();
      if (dbReady) {
        await offlineDb.paymentRequests.update(requestId, updateData);
      }

      // Update local state
      setRequests(prev =>
        prev.map(r =>
          r.id === requestId
            ? { ...r, status, creator_response: response || null }
            : r
        )
      );

      if (navigator.onLine) {
        const { error } = await supabase
          .from('payment_requests')
          .update({
            status,
            creator_response: response || null,
          })
          .eq('id', requestId);

        if (error) throw error;

        // Send notification to requester
        const request = requests.find(r => r.id === requestId);
        if (request) {
          await sendPushNotification({
            phoneSuffixes: [request.requester_phone_suffix],
            title: status === 'approved' ? 'Payment Approved!' : 'Payment Request Rejected',
            body: status === 'approved'
              ? 'Your payment has been confirmed by the bill creator'
              : response || 'Your payment request was not approved',
            data: { type: 'bill', id: request.bill_id },
          });
        }
      } else {
        // Queue for sync when offline
        await addToSyncQueue('payment_request', 'update', requestId, updateData);
      }

      toast.success(status === 'approved' ? 'Payment approved' : 'Request rejected');
      return true;
    } catch (error) {
      console.error('Error updating payment request:', error);
      // Queue for later sync
      await addToSyncQueue('payment_request', 'update', requestId, {
        status,
        creator_response: response || null,
      });
      toast.success('Changes saved, will sync when online');
      return true;
    }
  };

  return {
    requests,
    loading,
    createRequest,
    updateRequestStatus,
    refetch: fetchRequests,
  };
}