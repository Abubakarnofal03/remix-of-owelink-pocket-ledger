import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface RecurringSchedule {
  id: string;
  user_id: string;
  entity_type: "bill" | "iou";
  template_data: Record<string, any>;
  frequency: "weekly" | "monthly" | "yearly";
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateRecurringInput {
  entity_type: "bill" | "iou";
  template_data: Record<string, any>;
  frequency: "weekly" | "monthly" | "yearly";
  next_run_at: string;
}

const QUERY_KEY = ["recurring_schedules"];

export function useRecurring() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_schedules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as RecurringSchedule[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateRecurringInput) => {
      const { data, error } = await supabase
        .from("recurring_schedules")
        .insert({
          user_id: user!.id,
          entity_type: input.entity_type,
          template_data: input.template_data,
          frequency: input.frequency,
          next_run_at: input.next_run_at,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Recurring schedule created");
    },
    onError: (err: any) => {
      toast.error("Failed to create recurring schedule");
      console.error(err);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("recurring_schedules")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Recurring schedule deleted");
    },
  });

  return {
    schedules,
    loading,
    createRecurring: createMutation.mutateAsync,
    toggleRecurring: toggleMutation.mutateAsync,
    deleteRecurring: deleteMutation.mutateAsync,
  };
}
