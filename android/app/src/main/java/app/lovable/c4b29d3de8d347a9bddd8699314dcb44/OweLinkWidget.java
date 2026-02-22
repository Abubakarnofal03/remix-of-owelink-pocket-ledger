package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class OweLinkWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "OWE_LINK_WIDGET";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String owedToYou = prefs.getString("owedToYou", "$0.00");
        String youOwe = prefs.getString("youOwe", "$0.00");
        String netBalance = prefs.getString("netBalance", "$0.00");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);

        // Set balance values
        views.setTextViewText(R.id.widget_owed_to_you, owedToYou);
        views.setTextViewText(R.id.widget_you_owe, youOwe);
        views.setTextViewText(R.id.widget_net_balance, netBalance);

        // Tap widget title to open app
        Intent openApp = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://home"));
        openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(context, 0, openApp, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_title, openAppPending);

        // Split Bill button
        Intent splitBill = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://bills/new"));
        splitBill.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent splitBillPending = PendingIntent.getActivity(context, 1, splitBill, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.btn_split_bill, splitBillPending);

        // Track Owe button
        Intent trackOwe = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://ious/new"));
        trackOwe.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent trackOwePending = PendingIntent.getActivity(context, 2, trackOwe, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.btn_track_owe, trackOwePending);

        // Add Expense button
        Intent addExpense = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://expenses"));
        addExpense.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent addExpensePending = PendingIntent.getActivity(context, 3, addExpense, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.btn_add_expense, addExpensePending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
