import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Contacts } from '@capacitor-community/contacts';

export function useAppPermissions() {
    const [permissionsGranted, setPermissionsGranted] = useState(false);
    const [permissionsRequested, setPermissionsRequested] = useState(false);

    const requestAllPermissions = useCallback(async () => {
        if (!Capacitor.isNativePlatform() || permissionsRequested) {
            return;
        }

        console.log('[Permissions] Requesting app permissions...');
        setPermissionsRequested(true);

        try {
            const results = {
                notifications: false,
                contacts: false,
            };

            // Request push notifications permission
            try {
                const pushPermStatus = await PushNotifications.requestPermissions();
                results.notifications = pushPermStatus.receive === 'granted';
                console.log('[Permissions] Notifications:', results.notifications ? 'granted' : 'denied');
            } catch (err) {
                console.warn('[Permissions] Push notifications error:', err);
            }

            // Request contacts permission
            try {
                const contactsPermStatus = await Contacts.requestPermissions();
                results.contacts = contactsPermStatus.contacts === 'granted';
                console.log('[Permissions] Contacts:', results.contacts ? 'granted' : 'denied');
            } catch (err) {
                console.warn('[Permissions] Contacts error:', err);
            }

            setPermissionsGranted(results.notifications || results.contacts);
            console.log('[Permissions] Request complete');
        } catch (err) {
            console.error('[Permissions] Error requesting permissions:', err);
        }
    }, [permissionsRequested]);

    useEffect(() => {
        // Request permissions on mount for native platforms
        if (Capacitor.isNativePlatform() && !permissionsRequested) {
            // Delay slightly to let the app settle after sign-in
            const timer = setTimeout(() => {
                requestAllPermissions();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [requestAllPermissions, permissionsRequested]);

    return {
        permissionsGranted,
        permissionsRequested,
        requestAllPermissions,
    };
}
