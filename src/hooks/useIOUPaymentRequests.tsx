import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPhoneSuffix, sendPushNotification } from '@/lib/notifications';

export interface IOUPaymentRequest {
  id: string;
  iou_id: string;
  requester_phone_suffix: string;
  amount_claimed: number;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  creator_response: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateRequestData {
  iou_id: string;
  amount_claimed: number;
  receipt_url?: string;
  message?: string;
}

interface UseIOUPaymentRequestsReturn {
  requests: IOUPaymentRequest[];
  loading: boolean;
  createRequest: (data: CreateRequestData) => Promise<boolean>;
  updateRequestStatus: (requestId: string, status: 'approved' | 'rejected', response?: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useIOUPaymentRequests(iouId: string | undefined): UseIOUPaymentRequestsReturn {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<IOUPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!iouId || !user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('iou_payment_requests')
        .select('*')
        .eq('iou_id', iouId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setRequests((data || []) as IOUPaymentRequest[]);
    } catch (error) {
      console.error('Error fetching IOU payment requests:', error);
    } finally {
      setLoading(false);
    }
  }, [iouId, user]);

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

    try {
      const { data: newRequest, error } = await supabase
        .from('iou_payment_requests')
        .insert({
          iou_id: data.iou_id,
          requester_phone_suffix: phoneSuffix,
          amount_claimed: data.amount_claimed,
          receipt_url: data.receipt_url || null,
          message: data.message || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      setRequests(prev => [newRequest as IOUPaymentRequest, ...prev]);

      // Get IOU info to send notification to creditor
      const { data: iou } = await supabase
        .from('ious')
        .select('creditor_id, description, currency, amount')
        .eq('id', data.iou_id)
        .single();

      if (iou) {
        // Get creditor's phone suffix for push notification
        const { data: creditorProfile } = await supabase
          .from('profiles')
          .select('phone_suffix')
          .eq('user_id', iou.creditor_id)
          .single();

        if (creditorProfile?.phone_suffix) {
          await sendPushNotification({
            phoneSuffixes: [creditorProfile.phone_suffix],
            title: 'Payment Confirmation Request',
            body: `Someone has requested payment confirmation for IOU: ${iou.currency} ${iou.amount}`,
            data: { type: 'iou', id: data.iou_id },
          });
        }
      }

      toast.success('Payment confirmation request sent');
      return true;
    } catch (error) {
      console.error('Error creating IOU payment request:', error);
      toast.error('Failed to send request');
      return false;
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: 'approved' | 'rejected',
    response?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('iou_payment_requests')
        .update({
          status,
          creator_response: response || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      // Update local state
      setRequests(prev =>
        prev.map(r =>
          r.id === requestId
            ? { ...r, status, creator_response: response || null }
            : r
        )
      );

      // Get request info for notification
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await sendPushNotification({
          phoneSuffixes: [request.requester_phone_suffix],
          title: status === 'approved' ? 'Payment Approved!' : 'Payment Request Rejected',
          body: status === 'approved'
            ? 'Your payment has been confirmed by the creditor'
            : response || 'Your payment request was not approved',
          data: { type: 'iou', id: request.iou_id },
        });
      }

      toast.success(status === 'approved' ? 'Payment approved' : 'Request rejected');
      return true;
    } catch (error) {
      console.error('Error updating IOU payment request:', error);
      toast.error('Failed to update request');
      return false;
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
