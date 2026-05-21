package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles "Add" / "Ignore" action button taps from suggestion notifications.
 * Rebroadcasts as TXN_SUGGESTION_ACTION which TxnBridge listens to (and forwards to JS).
 */
public class SuggestionActionReceiver extends BroadcastReceiver {

    public static final String ACTION_SUGGESTION_ACTION = "app.lovable.owelink.TXN_SUGGESTION_ACTION";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String id = intent.getStringExtra("id");
        String action = intent.getStringExtra("action"); // "add" | "ignore"
        int notificationId = intent.getIntExtra("notificationId", -1);

        if (notificationId != -1) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(notificationId);
        }

        Intent fwd = new Intent(ACTION_SUGGESTION_ACTION);
        fwd.setPackage(context.getPackageName());
        fwd.putExtra("id", id);
        fwd.putExtra("action", action);
        context.sendBroadcast(fwd);
    }
}
