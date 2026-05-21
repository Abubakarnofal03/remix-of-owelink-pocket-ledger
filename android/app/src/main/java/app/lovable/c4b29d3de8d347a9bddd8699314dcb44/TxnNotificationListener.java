package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import java.util.HashSet;
import java.util.Set;

/**
 * Captures notifications from a whitelist of bank/wallet packages and
 * forwards them as broadcasts the TxnBridge plugin can pick up.
 *
 * Privacy: We only look at known financial packages. Everything else is ignored.
 */
public class TxnNotificationListener extends NotificationListenerService {

    public static final String ACTION_TXN_SIGNAL = "app.lovable.owelink.TXN_SIGNAL";

    private static final Set<String> WHITELIST = new HashSet<>();
    static {
        // Pakistan banks & wallets (extend as needed)
        WHITELIST.add("com.meezanbank.mobile");
        WHITELIST.add("com.hbl.android.hblmobilebanking");
        WHITELIST.add("com.ubl.android");
        WHITELIST.add("com.bankalfalah.alfa");
        WHITELIST.add("pk.com.telenor.phoenix");      // EasyPaisa
        WHITELIST.add("com.techlogix.mobilinkcustomer"); // JazzCash
        WHITELIST.add("com.sadapay.mast");
        WHITELIST.add("pk.nayapay.app");
        // SMS default apps (signals from banking shortcodes will arrive here too)
        WHITELIST.add("com.google.android.apps.messaging");
        WHITELIST.add("com.samsung.android.messaging");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            String pkg = sbn.getPackageName();
            if (pkg == null || !WHITELIST.contains(pkg)) return;

            Notification n = sbn.getNotification();
            if (n == null) return;
            Bundle extras = n.extras;
            if (extras == null) return;

            CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

            String body = "";
            if (!TextUtils.isEmpty(big)) body = big.toString();
            else if (!TextUtils.isEmpty(text)) body = text.toString();

            if (TextUtils.isEmpty(body)) return;

            Intent broadcast = new Intent(ACTION_TXN_SIGNAL);
            broadcast.setPackage(getPackageName());
            broadcast.putExtra("packageName", pkg);
            broadcast.putExtra("title", title == null ? "" : title.toString());
            broadcast.putExtra("text", body);
            broadcast.putExtra("postedAt", sbn.getPostTime());
            sendBroadcast(broadcast);
        } catch (Throwable ignored) {
            // Never crash the listener
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // no-op
    }
}
