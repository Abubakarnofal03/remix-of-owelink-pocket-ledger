package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {

    private static final String PREFS_NAME = "OWE_LINK_WIDGET";

    @PluginMethod()
    public void updateWidget(PluginCall call) {
        String owedToYou = call.getString("owedToYou", "$0.00");
        String youOwe = call.getString("youOwe", "$0.00");
        String netBalance = call.getString("netBalance", "$0.00");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("owedToYou", owedToYou);
        editor.putString("youOwe", youOwe);
        editor.putString("netBalance", netBalance);
        editor.apply();

        // Trigger widget refresh
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName widgetComponent = new ComponentName(context, OweLinkWidget.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widgetComponent);
        for (int appWidgetId : appWidgetIds) {
            OweLinkWidget.updateAppWidget(context, appWidgetManager, appWidgetId);
        }

        call.resolve();
    }
}
