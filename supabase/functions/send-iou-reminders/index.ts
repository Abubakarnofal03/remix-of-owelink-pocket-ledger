import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── FCM helpers ─────────────────────────────────────────────────────

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email, sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsignedToken}.${signatureB64}`,
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) { console.error("Token response:", tokenData); throw new Error("Failed to get access token"); }
  return tokenData.access_token;
}

async function sendFCM(accessToken: string, projectId: string, fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
  const message = {
    message: {
      token: fcmToken, notification: { title, body }, data: data || {},
      android: { priority: "high", notification: { sound: "default", click_action: "FCM_PLUGIN_ACTIVITY", channel_id: "default" } },
      apns: { payload: { aps: { sound: "default", "content-available": 1 } } },
    },
  };
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!response.ok) { const error = await response.text(); console.error(`FCM error for token ${fcmToken.substring(0, 20)}...:`, error); return false; }
  return true;
}

// ── Entertaining templates ──────────────────────────────────────────

function getDebtorReminderMessage(amount: string, currency: string, desc: string, daysSinceCreated: number): { title: string; body: string } {
  const descInfo = desc ? ` for "${desc}"` : "";
  const includeDays = Math.random() < 0.4;

  const templates = [
    { title: "Hey! 💸", body: `You still owe ${currency} ${amount}${descInfo}. Time to square up!` },
    { title: "🔔 Friendly Nudge", body: `${currency} ${amount} is waiting to be paid${descInfo}. Don't keep 'em waiting!` },
    { title: "💳 Quick Reminder", body: `${currency} ${amount}${descInfo}. Your wallet called — it's ready! 😄` },
    { title: "🙈 Still Pending", body: `That ${currency} ${amount}${descInfo} hasn't gone anywhere... just like your debt 😅` },
    { title: "⏳ Tick Tock", body: `${currency} ${amount}${descInfo} is still hanging. Let's close this out! 🎯` },
  ];

  if (includeDays && daysSinceCreated > 1) {
    const daysTemplates = [
      { title: "😅 It's Been a While", body: `${daysSinceCreated} days and counting... ${currency} ${amount}${descInfo} is still unpaid!` },
      { title: `📆 ${daysSinceCreated} Days!`, body: `That ${currency} ${amount}${descInfo} has been pending for ${daysSinceCreated} days. Time to settle up!` },
      { title: "🕰️ Time Flies", body: `It's been ${daysSinceCreated} days since ${currency} ${amount}${descInfo}. Ready to pay? 💪` },
    ];
    return pick(daysTemplates);
  }

  return pick(templates);
}

function getCreditorConfirmation(debtorPhone: string, amount: string, currency: string, desc: string): { title: string; body: string } {
  const person = debtorPhone ? `***${debtorPhone.slice(-4)}` : "your debtor";
  const descInfo = desc ? ` about "${desc}"` : "";
  const templates = [
    { title: "📤 Reminder Sent!", body: `${person} just got nudged${descInfo}! They can't say they forgot now 😄` },
    { title: "✅ Done!", body: `${person} just got a reminder about the ${currency} ${amount} they owe you. You're welcome 😎` },
    { title: "🔔 Poked!", body: `We nudged ${person}${descInfo}. The ball's in their court now! ⚽` },
    { title: "💌 Sent!", body: `Reminder delivered to ${person} for ${currency} ${amount}. Let's see how fast they pay 🏃` },
  ];
  return pick(templates);
}

// ── Main handler ────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[send-iou-reminders] Starting reminder job...");

    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountRaw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");

    const parseServiceAccount = (raw: string) => {
      let jsonStr = raw.trim();
      if (!jsonStr.startsWith("{")) { try { const decoded = atob(jsonStr); if (decoded.trim().startsWith("{")) jsonStr = decoded.trim(); } catch { /* ignore */ } }
      try { return JSON.parse(jsonStr); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT is invalid JSON"); }
    };

    const serviceAccount = parseServiceAccount(serviceAccountRaw);
    const projectId = serviceAccount.project_id;
    if (!projectId || !serviceAccount.client_email || !serviceAccount.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing required fields");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: ious, error: iousError } = await supabase
      .from("ious")
      .select("id, description, currency, amount, amount_paid, due_date, debtor_phone_number, debtor_phone_suffix, reminder_interval_days, last_reminder_sent_at, direction, creditor_id, created_at")
      .eq("reminder_enabled", true)
      .is("deleted_at", null)
      .neq("status", "paid")
      .or("direction.is.null,direction.eq.owed_to_me");

    if (iousError) { console.error("[send-iou-reminders] Error fetching IOUs:", iousError); throw iousError; }

    console.log(`[send-iou-reminders] Found ${ious?.length || 0} IOUs with reminders enabled`);

    if (!ious || ious.length === 0) {
      return new Response(JSON.stringify({ message: "No IOUs need reminders", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let totalSent = 0;
    let accessToken: string | null = null;

    for (const iou of ious) {
      const intervalDays = iou.reminder_interval_days || 3;
      const lastSent = iou.last_reminder_sent_at ? new Date(iou.last_reminder_sent_at) : null;

      if (lastSent) {
        const daysSinceLastReminder = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastReminder < intervalDays) {
          console.log(`[send-iou-reminders] IOU ${iou.id} - skipping, only ${daysSinceLastReminder.toFixed(1)} days since last reminder`);
          continue;
        }
      }

      console.log(`[send-iou-reminders] Processing IOU: ${iou.id}`);

      const phoneSuffix = iou.debtor_phone_suffix || iou.debtor_phone_number.replace(/[^0-9]/g, '').slice(-10);
      if (!phoneSuffix) { console.log(`[send-iou-reminders] IOU ${iou.id} - no valid phone suffix`); continue; }

      const { data: tokens, error: tokensError } = await supabase
        .from("device_tokens").select("fcm_token").eq("phone_suffix", phoneSuffix);

      if (tokensError) { console.error(`[send-iou-reminders] Error fetching tokens for IOU ${iou.id}:`, tokensError); continue; }
      if (!tokens || tokens.length === 0) { console.log(`[send-iou-reminders] IOU ${iou.id} - no registered devices for debtor`); continue; }

      if (!accessToken) accessToken = await getAccessToken(serviceAccount);

      // Calculate days since created
      const daysSinceCreated = Math.floor((now.getTime() - new Date(iou.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const remaining = (iou.amount - iou.amount_paid).toFixed(2);
      const { title, body } = getDebtorReminderMessage(remaining, iou.currency, iou.description || "", daysSinceCreated);

      let iouSentCount = 0;
      for (const token of tokens) {
        const success = await sendFCM(accessToken, projectId, token.fcm_token, title, body, { type: "iou", id: iou.id });
        if (success) { iouSentCount++; totalSent++; }
      }

      console.log(`[send-iou-reminders] IOU ${iou.id} - sent ${iouSentCount}/${tokens.length} notifications`);

      if (iouSentCount > 0) {
        // Update last_reminder_sent_at
        await supabase.from("ious").update({ last_reminder_sent_at: now.toISOString() }).eq("id", iou.id);

        // Notify creditor that reminder was sent
        try {
          const { data: creditorProfile } = await supabase
            .from("profiles").select("phone_suffix").eq("user_id", iou.creditor_id).single();

          if (creditorProfile?.phone_suffix) {
            const { data: creditorTokens } = await supabase
              .from("device_tokens").select("fcm_token").eq("phone_suffix", creditorProfile.phone_suffix);

            if (creditorTokens && creditorTokens.length > 0) {
              const confirmation = getCreditorConfirmation(iou.debtor_phone_number, remaining, iou.currency, iou.description || "");
              for (const ct of creditorTokens) {
                await sendFCM(accessToken, projectId, ct.fcm_token, confirmation.title, confirmation.body, { type: "iou", id: iou.id });
              }
              console.log(`[send-iou-reminders] IOU ${iou.id} - notified creditor`);
            }
          }
        } catch (credErr) {
          console.error(`[send-iou-reminders] Error notifying creditor for IOU ${iou.id}:`, credErr);
        }
      }
    }

    console.log(`[send-iou-reminders] Job complete. Total notifications sent: ${totalSent}`);

    return new Response(JSON.stringify({ message: "Reminders processed", iousProcessed: ious.length, notificationsSent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[send-iou-reminders] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
