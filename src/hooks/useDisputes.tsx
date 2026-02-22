import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { sendPushNotification, getPhoneSuffix } from "@/lib/notifications";

export interface Dispute {
  id: string;
  entity_type: "iou" | "bill";
  entity_id: string;
  disputed_by_phone_suffix: string;
  disputed_by_user_id: string | null;
  reason: string;
  proposed_amount: number | null;
  status: "open" | "accepted" | "rejected" | "resolved";
  creator_response: string | null;
  created_at: string;
  updated_at: string;
}

export function useDisputes(entityType?: "iou" | "bill", entityId?: string) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["disputes", entityType, entityId];

  const { data: disputes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!entityId || !entityType) return [];
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Dispute[];
    },
    enabled: !!user && !!entityId && !!entityType,
  });

  const createDisputeMutation = useMutation({
    mutationFn: async (input: {
      entity_type: "iou" | "bill";
      entity_id: string;
      reason: string;
      proposed_amount?: number;
    }) => {
      if (!user || !profile) throw new Error("Not authenticated");
      const phoneSuffix = profile.phone_suffix || getPhoneSuffix(profile.phone_number);
      if (!phoneSuffix) throw new Error("Phone suffix not available");

      const { data, error } = await supabase
        .from("disputes")
        .insert({
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          disputed_by_phone_suffix: phoneSuffix,
          disputed_by_user_id: user.id,
          reason: input.reason,
          proposed_amount: input.proposed_amount || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Dispute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Dispute filed successfully");
    },
    onError: (e: Error) => {
      console.error("Error creating dispute:", e);
      toast.error("Failed to file dispute");
    },
  });

  const updateDisputeMutation = useMutation({
    mutationFn: async (input: {
      disputeId: string;
      status: "accepted" | "rejected";
      creator_response?: string;
    }) => {
      const { data, error } = await supabase
        .from("disputes")
        .update({
          status: input.status,
          creator_response: input.creator_response || null,
        } as any)
        .eq("id", input.disputeId)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Dispute;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`Dispute ${data.status}`);
    },
    onError: (e: Error) => {
      console.error("Error updating dispute:", e);
      toast.error("Failed to update dispute");
    },
  });

  return {
    disputes,
    loading: isLoading,
    createDispute: (input: { entity_type: "iou" | "bill"; entity_id: string; reason: string; proposed_amount?: number }) =>
      createDisputeMutation.mutateAsync(input),
    updateDispute: (disputeId: string, status: "accepted" | "rejected", creator_response?: string) =>
      updateDisputeMutation.mutateAsync({ disputeId, status, creator_response }),
    isCreating: createDisputeMutation.isPending,
    isUpdating: updateDisputeMutation.isPending,
  };
}
