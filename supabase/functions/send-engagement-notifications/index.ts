import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
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

async function sendFCM(
  accessToken: string, projectId: string, fcmToken: string,
  title: string, body: string, data?: Record<string, string>
): Promise<boolean> {
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: { sound: "default", click_action: "FCM_PLUGIN_ACTIVITY", channel_id: "default" },
      },
      apns: { payload: { aps: { sound: "default", "content-available": 1 } } },
    },
  };

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`FCM error for token ${fcmToken.substring(0, 20)}...:`, error);
    return false;
  }
  return true;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Notification pools ──────────────────────────────────────────────

interface NotifCandidate {
  title: string;
  body: string;
  data?: Record<string, string>;
}

function trackExpenseNudges(): NotifCandidate {
  const templates = [
    { title: "💰 Track Your Spending", body: "Got expenses to track? Pop them in before you forget!" },
    { title: "📝 Quick Expense Log", body: "Spent money today? Log it now — future you will thank you 🙏" },
    { title: "🧾 Don't Let It Slip", body: "That coffee, that lunch... add your expenses before they vanish from memory!" },
    { title: "💸 Expense Check-In", body: "How much did you spend today? Add it to OweLink and stay on top of things 📊" },
    { title: "🎯 Stay On Track", body: "A quick expense log a day keeps the budget stress away!" },
  ];
  return pick(templates);
}

function checkBalancesNudge(pendingCount: number): NotifCandidate {
  const templates = [
    { title: "📊 Check Your Balances", body: `You have ${pendingCount} pending items. Peek at your balances — you might be surprised!` },
    { title: "👀 Balance Update", body: `${pendingCount} things still open. Time for a quick check?` },
    { title: "🔍 How's Your Ledger?", body: `With ${pendingCount} pending items, it's worth a look! Open OweLink to review 💡` },
    { title: "💡 Quick Look", body: `You've got ${pendingCount} unsettled items. A quick peek could save you headaches later!` },
  ];
  return pick(templates);
}

function someoneOwesYou(amount: string, currency: string, description: string): NotifCandidate {
  const desc = description || "something";
  const templates = [
    { title: "👀 Money Waiting", body: `Someone still owes you ${currency} ${amount} for ${desc}... just saying 😏` },
    { title: "💵 Cha-Ching!", body: `${currency} ${amount} is owed to you for ${desc}. Maybe give them a nudge? 🤔` },
    { title: "🤑 Don't Forget", body: `You're owed ${currency} ${amount} for ${desc}. That money won't collect itself!` },
    { title: "📬 Pending Payment", body: `${currency} ${amount} for ${desc} is still outstanding. Time to follow up? 💪` },
  ];
  return pick(templates);
}

function addIOUNudge(): NotifCandidate {
  const templates = [
    { title: "🤔 Lent Money?", body: "Lent money to a friend? Add an IOU so you don't forget!" },
    { title: "📌 Pin That Debt", body: "Friend borrowed cash? Create an IOU and let OweLink remember for you 🧠" },
    { title: "💭 Don't Forget", body: "Paid for someone's meal? coffee? Add an IOU before it slips your mind!" },
    { title: "🤝 Keep Track", body: "Informal loans add up! Add an IOU and stay on top of who owes what." },
  ];
  return pick(templates);
}

function whatsappNudge(debtorDesc: string): NotifCandidate {
  const templates = [
    { title: "📲 Send a Nudge", body: `${debtorDesc} still hasn't paid? Send them a WhatsApp reminder from OweLink!` },
    { title: "💬 WhatsApp Reminder", body: `One tap to remind ${debtorDesc} about what they owe. Try the WhatsApp option! 😉` },
    { title: "🔔 Poke Them", body: `${debtorDesc} needs a gentle push? Use the WhatsApp nudge in OweLink!` },
  ];
  return pick(templates);
}

// ── Main handler ────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[engagement] Starting engagement notifications job...");

    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountRaw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");

    const parseServiceAccount = (raw: string) => {
      let jsonStr = raw.trim();
      if (!jsonStr.startsWith("{")) {
        try { const decoded = atob(jsonStr); if (decoded.trim().startsWith("{")) jsonStr = decoded.trim(); } catch { /* ignore */ }
      }
      try { return JSON.parse(jsonStr); } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT is invalid JSON"); }
    };

    const serviceAccount = parseServiceAccount(serviceAccountRaw);
    const projectId = serviceAccount.project_id;
    if (!projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is missing required fields");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all distinct users with device tokens
    const { data: deviceUsers, error: duErr } = await supabase
      .from("device_tokens")
      .select("user_id, phone_suffix, fcm_token");

    if (duErr) throw duErr;
    if (!deviceUsers || deviceUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No users with devices", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group tokens by user_id
    const userTokens = new Map<string, { phone_suffix: string; tokens: string[] }>();
    for (const dt of deviceUsers) {
      const existing = userTokens.get(dt.user_id);
      if (existing) {
        existing.tokens.push(dt.fcm_token);
      } else {
        userTokens.set(dt.user_id, { phone_suffix: dt.phone_suffix, tokens: [dt.fcm_token] });
      }
    }

    let accessToken: string | null = null;
    let totalSent = 0;

    for (const [userId, { phone_suffix, tokens }] of userTokens) {
      try {
        // Fetch user's pending IOUs (owed to them)
        const { data: pendingIOUs } = await supabase
          .from("ious")
          .select("id, amount, amount_paid, currency, description, debtor_phone_number")
          .eq("creditor_id", userId)
          .is("deleted_at", null)
          .neq("status", "paid")
          .eq("direction", "owed_to_me")
          .limit(10);

        // Fetch user's pending bills
        const { data: pendingBills } = await supabase
          .from("bills")
          .select("id")
          .eq("creator_id", userId)
          .is("deleted_at", null)
          .neq("status", "paid")
          .limit(10);

        const iouCount = pendingIOUs?.length || 0;
        const billCount = pendingBills?.length || 0;
        const totalPending = iouCount + billCount;

        // Build candidate pool
        const candidates: NotifCandidate[] = [];

        // Always eligible: track expense, add IOU
        candidates.push(trackExpenseNudges());
        candidates.push(addIOUNudge());

        // If they have pending items
        if (totalPending > 0) {
          candidates.push(checkBalancesNudge(totalPending));
        }

        // If they have IOUs owed to them, pick a random one
        if (pendingIOUs && pendingIOUs.length > 0) {
          const randomIOU = pick(pendingIOUs);
          const remaining = (randomIOU.amount - randomIOU.amount_paid).toFixed(2);
          candidates.push(someoneOwesYou(remaining, randomIOU.currency, randomIOU.description || ""));

          // WhatsApp nudge
          const debtorDesc = randomIOU.debtor_phone_number
            ? `the person who owes you ${randomIOU.currency} ${remaining}`
            : "your debtor";
          candidates.push(whatsappNudge(debtorDesc));
        }

        // Pick exactly 1 random notification per user per invocation
        const selected = pick(shuffle(candidates));

        if (!accessToken) {
          accessToken = await getAccessToken(serviceAccount);
        }

        for (const fcmToken of tokens) {
          const success = await sendFCM(accessToken, projectId, fcmToken, selected.title, selected.body, selected.data);
          if (success) totalSent++;
        }

        console.log(`[engagement] User ${userId} — sent 1 engagement notification`);
      } catch (userErr) {
        console.error(`[engagement] Error processing user ${userId}:`, userErr);
      }
    }

    console.log(`[engagement] Job complete. Total notifications sent: ${totalSent}`);

    return new Response(JSON.stringify({
      message: "Engagement notifications processed",
      usersProcessed: userTokens.size,
      notificationsSent: totalSent,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[engagement] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
