import { supabase } from '@/integrations/supabase/client';

interface SendNotificationParams {
  phoneSuffixes: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification({ phoneSuffixes, title, body, data }: SendNotificationParams) {
  if (phoneSuffixes.length === 0) return;

  try {
    const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        phone_suffixes: phoneSuffixes,
        title,
        body,
        data,
      },
    });

    if (error) {
      console.error('Error sending push notification:', error);
    } else {
      console.log('Push notification result:', result);
    }
  } catch (err) {
    console.error('Failed to send push notification:', err);
  }
}

// Helper to extract phone suffix from phone number
export function getPhoneSuffix(phoneNumber: string): string {
  return phoneNumber.replace(/[^0-9]/g, '').slice(-10);
}
