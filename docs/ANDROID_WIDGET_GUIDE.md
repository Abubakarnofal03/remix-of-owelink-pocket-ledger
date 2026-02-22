# OweLink Android Home-Screen Widget – Complete Guide

> **Prerequisites**: Android Studio, the OweLink project synced via `npx cap sync android`.

This guide walks you through every file you need to create or modify to add a native home-screen widget that shows your balance summary and three quick-action buttons (**Split Bill**, **Track Owe**, **Add Expense**).

---

## Table of Contents

1. [Widget Layout XML](#1-widget-layout-xml)
2. [Widget Background Drawable](#2-widget-background-drawable)
3. [Button Icon Drawables](#3-button-icon-drawables)
4. [Widget Provider Config](#4-widget-provider-config)
5. [String Resources](#5-string-resources)
6. [Widget Provider Java Class](#6-widget-provider-java-class)
7. [Capacitor Bridge Plugin](#7-capacitor-bridge-plugin)
8. [Register in AndroidManifest.xml](#8-register-in-androidmanifestxml)
9. [Register Plugin in MainActivity.java](#9-register-plugin-in-mainactivityjava)
10. [Build & Test](#10-build--test)

---

## 1. Widget Layout XML

Create **`android/app/src/main/res/layout/widget_layout.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="16dp">

    <!-- App title -->
    <TextView
        android:id="@+id/widget_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="OweLink"
        android:textColor="#FFFFFF"
        android:textSize="16sp"
        android:textStyle="bold"
        android:layout_marginBottom="8dp" />

    <!-- Balance row -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:layout_marginBottom="12dp">

        <!-- Owed to You -->
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="@string/widget_owed_to_you_label"
                android:textColor="#9CA3AF"
                android:textSize="10sp" />

            <TextView
                android:id="@+id/widget_owed_to_you"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="$0.00"
                android:textColor="#34D399"
                android:textSize="16sp"
                android:textStyle="bold" />
        </LinearLayout>

        <!-- You Owe -->
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="@string/widget_you_owe_label"
                android:textColor="#9CA3AF"
                android:textSize="10sp" />

            <TextView
                android:id="@+id/widget_you_owe"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="$0.00"
                android:textColor="#F87171"
                android:textSize="16sp"
                android:textStyle="bold" />
        </LinearLayout>

        <!-- Net -->
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="@string/widget_net_label"
                android:textColor="#9CA3AF"
                android:textSize="10sp" />

            <TextView
                android:id="@+id/widget_net_balance"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="$0.00"
                android:textColor="#FFFFFF"
                android:textSize="16sp"
                android:textStyle="bold" />
        </LinearLayout>
    </LinearLayout>

    <!-- Divider -->
    <View
        android:layout_width="match_parent"
        android:layout_height="1dp"
        android:background="#374151"
        android:layout_marginBottom="10dp" />

    <!-- Quick Action Buttons -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center">

        <!-- Split Bill -->
        <LinearLayout
            android:id="@+id/btn_split_bill"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center"
            android:clickable="true"
            android:background="?android:attr/selectableItemBackground"
            android:padding="6dp">

            <ImageView
                android:layout_width="24dp"
                android:layout_height="24dp"
                android:src="@drawable/ic_widget_bill"
                android:contentDescription="@string/widget_split_bill" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="@string/widget_split_bill"
                android:textColor="#D1D5DB"
                android:textSize="10sp"
                android:layout_marginTop="2dp" />
        </LinearLayout>

        <!-- Track Owe -->
        <LinearLayout
            android:id="@+id/btn_track_owe"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center"
            android:clickable="true"
            android:background="?android:attr/selectableItemBackground"
            android:padding="6dp">

            <ImageView
                android:layout_width="24dp"
                android:layout_height="24dp"
                android:src="@drawable/ic_widget_owe"
                android:contentDescription="@string/widget_track_owe" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="@string/widget_track_owe"
                android:textColor="#D1D5DB"
                android:textSize="10sp"
                android:layout_marginTop="2dp" />
        </LinearLayout>

        <!-- Add Expense -->
        <LinearLayout
            android:id="@+id/btn_add_expense"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center"
            android:clickable="true"
            android:background="?android:attr/selectableItemBackground"
            android:padding="6dp">

            <ImageView
                android:layout_width="24dp"
                android:layout_height="24dp"
                android:src="@drawable/ic_widget_expense"
                android:contentDescription="@string/widget_add_expense" />

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="@string/widget_add_expense"
                android:textColor="#D1D5DB"
                android:textSize="10sp"
                android:layout_marginTop="2dp" />
        </LinearLayout>
    </LinearLayout>
</LinearLayout>
```

---

## 2. Widget Background Drawable

Create **`android/app/src/main/res/drawable/widget_background.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#1F2937" />
    <corners android:radius="16dp" />
    <stroke
        android:width="1dp"
        android:color="#374151" />
</shape>
```

---

## 3. Button Icon Drawables

You need three simple vector icons. Create these in `android/app/src/main/res/drawable/`:

**`ic_widget_bill.xml`** (receipt icon):
```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#60A5FA"
        android:pathData="M19,3H5C3.9,3 3,3.9 3,5v14c0,1.1 0.9,2 2,2h14c1.1,0 2,-0.9 2,-2V5C21,3.9 20.1,3 19,3zM17,13H7v-2h10V13zM17,9H7V7h10V9z" />
</vector>
```

**`ic_widget_owe.xml`** (handshake / IOU icon):
```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FBBF24"
        android:pathData="M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM13,17h-2v-2h2V17zM13,13h-2V7h2V13z" />
</vector>
```

**`ic_widget_expense.xml`** (plus-circle icon):
```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#34D399"
        android:pathData="M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM17,13h-4v4h-2v-4H7v-2h4V7h2v4h4V13z" />
</vector>
```

> **Tip**: Replace these with your own custom icons if you prefer. These are simple Material-style placeholders.

---

## 4. Widget Provider Config

Create **`android/app/src/main/res/xml/owelink_widget_info.xml`**:

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_layout"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_description" />
```

---

## 5. String Resources

Add these to **`android/app/src/main/res/values/strings.xml`** (alongside existing strings):

```xml
<!-- Widget -->
<string name="widget_description">View your OweLink balances at a glance</string>
<string name="widget_owed_to_you_label">Owed to You</string>
<string name="widget_you_owe_label">You Owe</string>
<string name="widget_net_label">Net</string>
<string name="widget_split_bill">Split Bill</string>
<string name="widget_track_owe">Track Owe</string>
<string name="widget_add_expense">Add Expense</string>
```

---

## 6. Widget Provider Java Class

Create **`android/app/src/main/java/app/lovable/c4b29d3de8d347a9bddd8699314dcb44/OweLinkWidget.java`**:

```java
package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import java.text.NumberFormat;
import java.util.Locale;

public class OweLinkWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "OWE_LINK_WIDGET";
    private static final String KEY_OWED_TO_YOU = "owedToYou";
    private static final String KEY_YOU_OWE = "youOwe";
    private static final String KEY_NET_BALANCE = "netBalance";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        float owedToYou = prefs.getFloat(KEY_OWED_TO_YOU, 0f);
        float youOwe = prefs.getFloat(KEY_YOU_OWE, 0f);
        float netBalance = prefs.getFloat(KEY_NET_BALANCE, 0f);

        NumberFormat fmt = NumberFormat.getCurrencyInstance(Locale.US);

        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);

            // Set balance text
            views.setTextViewText(R.id.widget_owed_to_you, fmt.format(owedToYou));
            views.setTextViewText(R.id.widget_you_owe, fmt.format(youOwe));
            views.setTextViewText(R.id.widget_net_balance, fmt.format(netBalance));

            // Color the net balance
            int netColor = netBalance >= 0 ? 0xFF34D399 : 0xFFF87171;
            views.setTextColor(R.id.widget_net_balance, netColor);

            // Tap on widget body → open app
            Intent openApp = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://dashboard"));
            openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent openAppPi = PendingIntent.getActivity(
                context, 0, openApp, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, openAppPi);

            // Split Bill button → owelink://bills/new
            Intent billIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://bills/new"));
            billIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent billPi = PendingIntent.getActivity(
                context, 1, billIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.btn_split_bill, billPi);

            // Track Owe button → owelink://ious/new
            Intent oweIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://ious/new"));
            oweIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent owePi = PendingIntent.getActivity(
                context, 2, oweIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.btn_track_owe, owePi);

            // Add Expense button → owelink://expenses
            Intent expenseIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("owelink://expenses"));
            expenseIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent expensePi = PendingIntent.getActivity(
                context, 3, expenseIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.btn_add_expense, expensePi);

            appWidgetManager.updateAppWidget(widgetId, views);
        }
    }
}
```

---

## 7. Capacitor Bridge Plugin

Create **`android/app/src/main/java/app/lovable/c4b29d3de8d347a9bddd8699314dcb44/WidgetBridge.java`**:

```java
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

    @PluginMethod
    public void updateWidget(PluginCall call) {
        float owedToYou = call.getFloat("owedToYou", 0f);
        float youOwe = call.getFloat("youOwe", 0f);
        float netBalance = call.getFloat("netBalance", 0f);

        Context context = getContext();

        // Save to SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putFloat("owedToYou", owedToYou)
            .putFloat("youOwe", youOwe)
            .putFloat("netBalance", netBalance)
            .apply();

        // Trigger widget refresh
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        ComponentName widget = new ComponentName(context, OweLinkWidget.class);
        int[] ids = mgr.getAppWidgetIds(widget);
        if (ids.length > 0) {
            new OweLinkWidget().onUpdate(context, mgr, ids);
        }

        call.resolve();
    }
}
```

---

## 8. Register in AndroidManifest.xml

Add this **inside** the `<application>` tag in `android/app/src/main/AndroidManifest.xml`, after the `</activity>` closing tag:

```xml
<!-- OweLink Home Screen Widget -->
<receiver
    android:name=".OweLinkWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/owelink_widget_info" />
</receiver>
```

---

## 9. Register Plugin in MainActivity.java

Update **`android/app/src/main/java/app/lovable/c4b29d3de8d347a9bddd8699314dcb44/MainActivity.java`**:

```java
package app.lovable.c4b29d3de8d347a9bddd8699314dcb44;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridge.class);
        super.onCreate(savedInstanceState);
    }
}
```

---

## 10. Build & Test

```bash
# 1. Sync web assets to native project
npx cap sync android

# 2. Open in Android Studio
npx cap open android

# 3. Build and run on device/emulator from Android Studio

# 4. Long-press on home screen → Widgets → find "OweLink" → drag to home screen
```

### Testing the Widget

1. Open the OweLink app and let it load your balances (this pushes data to the widget via the bridge)
2. Go to your home screen — the widget should show updated balances
3. Tap **Split Bill** → app opens to New Bill screen
4. Tap **Track Owe** → app opens to New IOU screen
5. Tap **Add Expense** → app opens to Expenses screen
6. Tap the widget body → app opens to Dashboard

---

## How It Works

```
┌─────────────┐     updateWidget()     ┌──────────────┐
│  useBalances │ ──────────────────────>│ widgetBridge  │
│   (React)    │                        │    (.ts)      │
└─────────────┘                        └──────┬───────┘
                                              │ Capacitor
                                              ▼
                                     ┌──────────────────┐
                                     │  WidgetBridge     │
                                     │  (Java Plugin)    │
                                     └──────┬───────────┘
                                            │ SharedPreferences
                                            ▼
                                     ┌──────────────────┐
                                     │  OweLinkWidget    │
                                     │  (AppWidgetProv.) │
                                     └──────────────────┘
                                            │ RemoteViews
                                            ▼
                                     ┌──────────────────┐
                                     │  Home Screen      │
                                     │  Widget UI        │
                                     └──────────────────┘
```

### Deep Link Routing

The widget buttons use `PendingIntent` with the `owelink://` URI scheme, which is already configured in `AndroidManifest.xml`. The `useCapacitor` hook in the web app listens for `appUrlOpen` events and routes accordingly:

| Button | Deep Link | Routes To |
|--------|-----------|-----------|
| Split Bill | `owelink://bills/new` | `/bills/new` |
| Track Owe | `owelink://ious/new` | `/ious/new` |
| Add Expense | `owelink://expenses` | `/expenses` |
| Widget body | `owelink://dashboard` | `/dashboard` |
