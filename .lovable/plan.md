

# Android Widget Guide + Quick Action Buttons

## Overview
This plan creates two things:
1. A complete step-by-step guide document (`docs/ANDROID_WIDGET_GUIDE.md`) with every file and command needed to build an Android home screen widget
2. A TypeScript bridge file (`src/lib/widgetBridge.ts`) for pushing data from the app to the widget

The widget will display your balance summary AND include 3 quick action buttons: **Split Bill**, **Track Owe**, and **Add Expense** -- tapping any of them opens the app directly to that screen.

## What Gets Created

### File 1: `docs/ANDROID_WIDGET_GUIDE.md`
A comprehensive markdown guide containing complete, copy-pasteable code for:

1. **Widget Layout** (`res/layout/widget_layout.xml`)
   - Balance display: "Owed to You", "You Owe", "Net Balance"
   - 3 action buttons at the bottom: Split Bill, Track Owe, Add Expense
   - Each button uses a `PendingIntent` that opens the app via deep links (`owelink://bills/new`, `owelink://ious/new`, `owelink://expenses`)

2. **Widget Background** (`res/drawable/widget_background.xml`)
   - Rounded rectangle matching OweLink's dark theme

3. **Widget Provider Config** (`res/xml/owelink_widget_info.xml`)
   - Size, update interval, preview, resize settings

4. **Widget Provider Class** (`OweLinkWidget.java`)
   - Reads balances from `SharedPreferences`
   - Sets up `RemoteViews` with balance data
   - Configures `PendingIntent` for each quick action button (bill, owe, expense)
   - Configures tap-to-open on the main widget area

5. **Capacitor Bridge Plugin** (`WidgetBridge.java`)
   - Receives balance data from the web app
   - Writes to `SharedPreferences`
   - Triggers widget refresh via `AppWidgetManager`

6. **AndroidManifest.xml changes**
   - Exact XML to register the widget receiver

7. **MainActivity.java changes**
   - Plugin registration line

8. **Build and test commands**
   - `npx cap sync android`, build in Android Studio, add widget from launcher

### File 2: `src/lib/widgetBridge.ts`
TypeScript code that:
- Uses `registerPlugin('WidgetBridge')` from Capacitor
- Exports an `updateWidget(owedToYou, youOwe, netBalance)` function
- Can be called from `useBalances` hook whenever balances update

## Technical Details

The widget quick action buttons work by leveraging the existing deep link infrastructure already set up in `AndroidManifest.xml` (the `owelink://` scheme) and the `useCapacitor` hook that handles routing. Each button creates a `PendingIntent` with the corresponding deep link URI:
- Split Bill button -> `owelink://bills/new`
- Track Owe button -> `owelink://ious/new`  
- Add Expense button -> `owelink://expenses`

No changes to existing app files are needed beyond creating the two new files.

