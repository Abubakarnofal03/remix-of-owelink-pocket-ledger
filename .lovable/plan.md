

## Plan: In-App Self-Update System

There are two types of updates for a Capacitor app. Since most of your app logic lives in the web layer (HTML/JS/CSS), **web-layer OTA updates** cover 95% of cases without needing a new APK. For the rare native changes (new Capacitor plugins, Android manifest changes), you'd need a full APK update.

This plan covers **both**:

---

### 1. Database: `app_versions` table

New table to track releases:

```sql
CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_code integer NOT NULL,
  version_name text NOT NULL,
  release_notes text,
  apk_url text,           -- URL to APK in storage (for native updates)
  web_bundle_url text,     -- URL to web bundle zip (for OTA updates)
  update_type text NOT NULL DEFAULT 'web', -- 'web' or 'native'
  is_mandatory boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

No RLS needed for SELECT (all users can check for updates). INSERT/UPDATE restricted to admin.

### 2. Storage Bucket: `app-updates`

A storage bucket to hold APK files and/or web bundles uploaded by admin.

### 3. Update Check Hook: `src/hooks/useAppUpdate.tsx`

- On app launch, query `app_versions` for latest version
- Compare against current `versionCode` stored in app
- If newer version exists:
  - **Web update**: Download zip, extract to Capacitor's web directory, reload app
  - **Native update (APK)**: Show dialog, download APK via `@capacitor/filesystem`, trigger Android install intent using a small custom Capacitor plugin
- Show a toast/dialog: "Update available! v{version_name} — {release_notes}"
- If `is_mandatory`, block app usage until updated

### 4. APK Install (Android only)

For APK sideloading, a small native Java class (`AppUpdater.java`) is needed to:
- Open the downloaded APK file using `ACTION_INSTALL_PACKAGE` intent
- Requires `REQUEST_INSTALL_PACKAGES` permission in AndroidManifest.xml
- Uses the existing `FileProvider` already configured in the manifest

### 5. Integration

- Call `useAppUpdate()` in `App.tsx` on mount
- Store current version in `src/lib/constants.ts` (e.g., `APP_VERSION_CODE = 1`)
- Show update dialog with release notes and download progress

### Files to Create/Change

1. **Database migration** — `app_versions` table + storage bucket
2. `src/hooks/useAppUpdate.tsx` — Version check + download + install logic
3. `src/lib/constants.ts` — Add `APP_VERSION_CODE`
4. `src/App.tsx` — Call the hook
5. `android/app/src/main/java/.../AppUpdater.java` — Native install intent plugin
6. `android/app/src/main/AndroidManifest.xml` — Add `REQUEST_INSTALL_PACKAGES` permission
7. `android/app/src/main/java/.../MainActivity.java` — Register AppUpdater plugin

### Caveat

APK sideloading requires users to have "Install from unknown sources" enabled for the app. The update dialog should guide them through this if needed. Alternatively, if you publish to Play Store, you could use Google's official In-App Updates API instead — but the custom approach gives you full control without Play Store dependency.

