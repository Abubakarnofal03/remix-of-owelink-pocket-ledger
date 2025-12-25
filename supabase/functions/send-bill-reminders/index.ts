import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get OAuth2 access token from service account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = serviceAccount.private_key;
  const pemContents = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    console.error("Token response:", tokenData);
    throw new Error("Failed to get access token");
  }
  return tokenData.access_token;
}

async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    },
  };

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`FCM error for token ${fcmToken.substring(0, 20)}...:`, error);
    return false;
  }
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[send-bill-reminders] Starting reminder job...");

    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountRaw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    }

    const parseServiceAccount = (raw: string) => {
      let jsonStr = raw.trim();
      if (!jsonStr.startsWith("{")) {
        try {
          const decoded = atob(jsonStr);
          if (decoded.trim().startsWith("{")) jsonStr = decoded.trim();
        } catch {
          // ignore
        }
      }
      try {
        return JSON.parse(jsonStr);
      } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is invalid JSON");
      }
    };

    const serviceAccount = parseServiceAccount(serviceAccountRaw);
    const projectId = serviceAccount.project_id;
    if (!projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is missing required fields");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get bills that need reminders sent
    // Conditions:
    // - status is not 'paid'
    // - reminder_enabled = true
    // - deleted_at IS NULL
    // - Either last_reminder_sent_at is NULL OR (now - last_reminder_sent_at) >= reminder_interval_days
    const { data: bills, error: billsError } = await supabase
      .from("bills")
      .select(`
        id,
        title,
        currency,
        total_amount,
        due_date,
        reminder_interval_days,
        last_reminder_sent_at
      `)
      .eq("reminder_enabled", true)
      .is("deleted_at", null)
      .neq("status", "paid");

    if (billsError) {
      console.error("[send-bill-reminders] Error fetching bills:", billsError);
      throw billsError;
    }

    console.log(`[send-bill-reminders] Found ${bills?.length || 0} bills with reminders enabled`);

    if (!bills || bills.length === 0) {
      return new Response(JSON.stringify({ message: "No bills need reminders", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let totalSent = 0;
    let accessToken: string | null = null;

    for (const bill of bills) {
      // Check if reminder is due
      const intervalDays = bill.reminder_interval_days || 3;
      const lastSent = bill.last_reminder_sent_at ? new Date(bill.last_reminder_sent_at) : null;
      
      if (lastSent) {
        const daysSinceLastReminder = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastReminder < intervalDays) {
          console.log(`[send-bill-reminders] Bill ${bill.id} - skipping, only ${daysSinceLastReminder.toFixed(1)} days since last reminder`);
          continue;
        }
      }

      console.log(`[send-bill-reminders] Processing bill: ${bill.id} - ${bill.title}`);

      // Get unpaid participants
      const { data: participants, error: participantsError } = await supabase
        .from("bill_participants")
        .select("phone_number, phone_suffix, amount_owed, amount_paid, status")
        .eq("bill_id", bill.id)
        .neq("status", "paid");

      if (participantsError) {
        console.error(`[send-bill-reminders] Error fetching participants for bill ${bill.id}:`, participantsError);
        continue;
      }

      if (!participants || participants.length === 0) {
        console.log(`[send-bill-reminders] Bill ${bill.id} - no unpaid participants`);
        continue;
      }

      // Get phone suffixes
      const phoneSuffixes = participants
        .map(p => p.phone_suffix || p.phone_number.replace(/[^0-9]/g, '').slice(-10))
        .filter(Boolean);

      if (phoneSuffixes.length === 0) {
        console.log(`[send-bill-reminders] Bill ${bill.id} - no valid phone suffixes`);
        continue;
      }

      // Get device tokens for these phone suffixes
      const { data: tokens, error: tokensError } = await supabase
        .from("device_tokens")
        .select("fcm_token, phone_suffix")
        .in("phone_suffix", phoneSuffixes);

      if (tokensError) {
        console.error(`[send-bill-reminders] Error fetching tokens for bill ${bill.id}:`, tokensError);
        continue;
      }

      if (!tokens || tokens.length === 0) {
        console.log(`[send-bill-reminders] Bill ${bill.id} - no registered devices for participants`);
        continue;
      }

      // Get access token (once per job run)
      if (!accessToken) {
        accessToken = await getAccessToken(serviceAccount);
      }

      // Send notifications
      let billSentCount = 0;
      for (const token of tokens) {
        // Find the participant for this token to get their specific amount
        const participant = participants.find(p => 
          (p.phone_suffix || p.phone_number.replace(/[^0-9]/g, '').slice(-10)) === token.phone_suffix
        );
        
        const remaining = participant ? participant.amount_owed - participant.amount_paid : 0;
        const dueInfo = bill.due_date 
          ? ` Due: ${new Date(bill.due_date).toLocaleDateString()}`
          : '';

        const success = await sendFCMNotification(
          accessToken,
          projectId,
          token.fcm_token,
          `Payment Reminder: ${bill.title}`,
          `You owe ${bill.currency} ${remaining.toFixed(2)}.${dueInfo}`,
          { type: "bill", id: bill.id }
        );

        if (success) {
          billSentCount++;
          totalSent++;
        }
      }

      console.log(`[send-bill-reminders] Bill ${bill.id} - sent ${billSentCount}/${tokens.length} notifications`);

      // Update last_reminder_sent_at
      if (billSentCount > 0) {
        const { error: updateError } = await supabase
          .from("bills")
          .update({ last_reminder_sent_at: now.toISOString() })
          .eq("id", bill.id);

        if (updateError) {
          console.error(`[send-bill-reminders] Error updating last_reminder_sent_at for bill ${bill.id}:`, updateError);
        }
      }
    }

    console.log(`[send-bill-reminders] Job complete. Total notifications sent: ${totalSent}`);

    return new Response(JSON.stringify({ 
      message: "Reminders processed",
      billsProcessed: bills.length,
      notificationsSent: totalSent 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[send-bill-reminders] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
