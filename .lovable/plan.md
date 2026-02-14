

# Persistent Login & Biometric Authentication

## Problem
The app randomly logs users out, especially when online. The current session caching in localStorage has an expiry check that sometimes clears valid sessions. We need bulletproof offline login persistence and biometric unlock for quick re-entry.

## Solution Overview

### Part 1: Rock-Solid Offline Login Persistence

**Root cause of random logouts:** The `loadCachedSession` function expires cached sessions after ~1 hour buffer from `expires_at`. When the app opens online, `supabase.auth.getSession()` can fail or return null on flaky connections, and the cached session may have been cleared due to the expiry check. This creates a logout loop.

**Fix:**
- Store a persistent `logged_in` flag in localStorage that is ONLY removed on explicit sign out
- Extend the cached session expiry buffer significantly (from 1 hour to 30 days) -- the session is just for offline UI access, not for actual API auth
- When `getSession()` returns null but `logged_in` flag exists, always trust cached data instead of logging the user out
- On explicit `signOut()`, clear the flag, cached session, and cached profile
- Never auto-clear session cache on expiry -- only on explicit logout

### Part 2: Biometric Authentication (Fingerprint / Face ID)

**Plugin:** `capacitor-native-biometric` -- lightweight, well-maintained, supports both Android (fingerprint/face) and iOS (Touch ID/Face ID).

**Flow:**
1. After successful phone+password login, offer to enable biometric login via a prompt
2. If enabled, securely store credentials using the plugin's native credential storage (Android Keystore / iOS Keychain)
3. On next app open, if biometric is enabled, show a biometric prompt instead of the login page
4. If biometric succeeds, retrieve stored credentials and auto-sign in (online) or load cached session (offline)
5. If biometric fails or is cancelled, fall back to normal phone+password login
6. Settings page gets a toggle to enable/disable biometric login

## Technical Details

### Files to Create
- **`src/hooks/useBiometric.tsx`** -- Hook wrapping `capacitor-native-biometric` plugin for checking availability, authenticating, and storing/retrieving credentials

### Files to Modify

- **`src/hooks/useAuth.tsx`**
  - Add `logged_in` flag to localStorage on successful sign in/sign up
  - Remove expiry check from `loadCachedSession` (only clear on explicit logout)
  - In the `getSession` flow: if server returns null but `logged_in` flag exists, trust cached data
  - On `signOut()`: clear `logged_in` flag, biometric credentials, all caches
  - Add `biometricSignIn()` method to context that retrieves stored credentials and calls `signIn()`

- **`src/pages/Auth.tsx`**
  - On mount, check if biometric is enabled and available
  - If yes, auto-trigger biometric prompt before showing login form
  - Show a "Use Biometric" button as fallback if user dismissed the auto-prompt
  - After successful password login, show a prompt: "Enable fingerprint/face login for faster access?"

- **`src/pages/Settings.tsx`**
  - Add a "Biometric Login" toggle under the Security section
  - Toggle enables/disables biometric, stores/clears credentials accordingly

- **`src/App.tsx`**
  - No changes needed (auth state flows through existing AuthProvider)

### New Dependency
- `capacitor-native-biometric` -- provides `NativeBiometric.isAvailable()`, `NativeBiometric.verifyIdentity()`, `NativeBiometric.setCredentials()`, `NativeBiometric.getCredentials()`, `NativeBiometric.deleteCredentials()`

### Biometric Credential Storage
The plugin uses Android Keystore / iOS Keychain to securely store the user's phone number and password. These are encrypted at the OS level and only accessible after biometric verification.

### User Flow

```text
App Opens
    |
    v
Is "logged_in" flag set?
    |
   No --> Show Auth page (normal login)
    |
   Yes --> Is biometric enabled?
              |
             No --> Load cached session, go to dashboard
              |
             Yes --> Show biometric prompt
                        |
                     Success --> Retrieve credentials, auto-login, dashboard
                        |
                     Fail --> Show Auth page with phone+password form
```

After running `npx cap sync`, biometric will work on physical devices with fingerprint sensors or Face ID.

