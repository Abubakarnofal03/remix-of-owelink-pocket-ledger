import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getNextRunDate(current: Date, frequency: string): Date {
  const next = new Date(current);
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active schedules that are due
    const { data: schedules, error: fetchError } = await supabase
      .from("recurring_schedules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    let created = 0;

    for (const schedule of schedules || []) {
      const template = schedule.template_data as Record<string, any>;

      try {
        if (schedule.entity_type === "bill") {
          // Create bill
          const { data: bill, error: billError } = await supabase
            .from("bills")
            .insert({
              creator_id: schedule.user_id,
              title: template.title,
              description: template.description || null,
              total_amount: template.total_amount,
              currency: template.currency || "USD",
              due_date: template.due_date
                ? new Date(
                    Date.now() +
                      (new Date(template.due_date).getTime() - new Date(template.created_ref || Date.now()).getTime())
                  ).toISOString()
                : null,
            })
            .select()
            .single();

          if (billError) throw billError;

          // Create participants
          if (template.participants?.length) {
            const participants = template.participants.map((p: any) => ({
              bill_id: bill.id,
              phone_number: p.phone_number,
              amount_owed: p.amount_owed,
              amount_paid: 0,
              status: "pending",
            }));
            await supabase.from("bill_participants").insert(participants);
          }
        } else if (schedule.entity_type === "iou") {
          await supabase.from("ious").insert({
            creditor_id: schedule.user_id,
            debtor_phone_number: template.debtor_phone_number,
            debtor_phone_suffix: template.debtor_phone_suffix || null,
            amount: template.amount,
            currency: template.currency || "USD",
            description: template.description || null,
            direction: template.direction || "owed_to_me",
            due_date: template.due_date
              ? new Date(
                  Date.now() +
                    (new Date(template.due_date).getTime() - new Date(template.created_ref || Date.now()).getTime())
                ).toISOString()
              : null,
          });
        }

        // Update schedule
        const nextRun = getNextRunDate(new Date(schedule.next_run_at), schedule.frequency);
        await supabase
          .from("recurring_schedules")
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);

        created++;
      } catch (err) {
        console.error(`Error processing schedule ${schedule.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ processed: schedules?.length || 0, created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-recurring error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
