package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/**
 * Optional SMS source for transaction signals. Only active if user has granted
 * RECEIVE_SMS permission AND enabled SMS scanning. We just rebroadcast the body
 * as a TXN_SIGNAL with packageName="sms:<sender>".
 */
public class SmsReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
                return;
            }
            Bundle bundle = intent.getExtras();
            if (bundle == null) return;

            SmsMessage[] msgs = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (msgs == null) return;

            StringBuilder body = new StringBuilder();
            String sender = "";
            long ts = System.currentTimeMillis();
            for (SmsMessage m : msgs) {
                if (m == null) continue;
                if (body.length() == 0 && m.getOriginatingAddress() != null) {
                    sender = m.getOriginatingAddress();
                }
                if (m.getMessageBody() != null) body.append(m.getMessageBody());
                if (m.getTimestampMillis() > 0) ts = m.getTimestampMillis();
            }
            if (body.length() == 0) return;

            Intent broadcast = new Intent(TxnNotificationListener.ACTION_TXN_SIGNAL);
            broadcast.setPackage(context.getPackageName());
            broadcast.putExtra("packageName", "sms:" + sender);
            broadcast.putExtra("title", sender);
            broadcast.putExtra("text", body.toString());
            broadcast.putExtra("postedAt", ts);
            context.sendBroadcast(broadcast);
        } catch (Throwable ignored) {
        }
    }
}
