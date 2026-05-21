package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TxnBridge")
public class TxnBridge extends Plugin {

    private static final String CHANNEL_ID = "owelink_txn_suggestions";
    private static final String CHANNEL_NAME = "Expense suggestions";

    private BroadcastReceiver signalReceiver;
    private BroadcastReceiver actionReceiver;

    @Override
    public void load() {
        super.load();
        ensureChannel();

        signalReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                JSObject data = new JSObject();
                data.put("packageName", intent.getStringExtra("packageName"));
                data.put("title", intent.getStringExtra("title"));
                data.put("text", intent.getStringExtra("text"));
                data.put("postedAt", intent.getLongExtra("postedAt", System.currentTimeMillis()));
                notifyListeners("txnSignal", data);
            }
        };

        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                JSObject data = new JSObject();
                data.put("id", intent.getStringExtra("id"));
                data.put("action", intent.getStringExtra("action"));
                notifyListeners("suggestionAction", data);
            }
        };

        IntentFilter f1 = new IntentFilter(TxnNotificationListener.ACTION_TXN_SIGNAL);
        IntentFilter f2 = new IntentFilter(SuggestionActionReceiver.ACTION_SUGGESTION_ACTION);
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(signalReceiver, f1, Context.RECEIVER_NOT_EXPORTED);
            ctx.registerReceiver(actionReceiver, f2, Context.RECEIVER_NOT_EXPORTED);
        } else {
            ctx.registerReceiver(signalReceiver, f1);
            ctx.registerReceiver(actionReceiver, f2);
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (signalReceiver != null) getContext().unregisterReceiver(signalReceiver);
            if (actionReceiver != null) getContext().unregisterReceiver(actionReceiver);
        } catch (Throwable ignored) {}
        super.handleOnDestroy();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);
            if (ch == null) {
                ch = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("Suggestions to add detected expenses");
                nm.createNotificationChannel(ch);
            }
        }
    }

    @PluginMethod
    public void hasNotificationAccess(PluginCall call) {
        Context ctx = getContext();
        String enabled = Settings.Secure.getString(ctx.getContentResolver(),
                "enabled_notification_listeners");
        ComponentName comp = new ComponentName(ctx, TxnNotificationListener.class);
        boolean ok = enabled != null && enabled.contains(comp.flattenToString());
        JSObject ret = new JSObject();
        ret.put("granted", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void hasSmsPermission(PluginCall call) {
        boolean ok = getContext().checkSelfPermission(Manifest.permission.RECEIVE_SMS)
                == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        // Use the standard app-details settings page so the user can toggle the permission.
        // Capacitor doesn't expose a simple runtime-permission request for arbitrary perms
        // from a custom plugin without extra plumbing.
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        i.setData(Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void showSuggestionNotification(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title", "Add Expense Detected");
        String body = call.getString("body", "");
        String deepLink = call.getString("deepLink", "owelink://suggestion/" + id);
        if (id == null) {
            call.reject("id required");
            return;
        }

        Context ctx = getContext();
        int notificationId = id.hashCode();

        // Review -> open app with deep link
        Intent reviewIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink));
        reviewIntent.setPackage(ctx.getPackageName());
        reviewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent reviewPi = PendingIntent.getActivity(ctx, notificationId, reviewIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Add
        Intent addIntent = new Intent(ctx, SuggestionActionReceiver.class);
        addIntent.putExtra("id", id);
        addIntent.putExtra("action", "add");
        addIntent.putExtra("notificationId", notificationId);
        PendingIntent addPi = PendingIntent.getBroadcast(ctx, notificationId * 10 + 1, addIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Ignore
        Intent ignoreIntent = new Intent(ctx, SuggestionActionReceiver.class);
        ignoreIntent.putExtra("id", id);
        ignoreIntent.putExtra("action", "ignore");
        ignoreIntent.putExtra("notificationId", notificationId);
        PendingIntent ignorePi = PendingIntent.getBroadcast(ctx, notificationId * 10 + 2, ignoreIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(reviewPi)
                .addAction(0, "Add", addPi)
                .addAction(0, "Review", reviewPi)
                .addAction(0, "Ignore", ignorePi);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(notificationId, b.build());

        call.resolve();
    }
}
