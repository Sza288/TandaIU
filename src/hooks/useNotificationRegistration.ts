import { useEffect, useState } from 'react';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import type { NotificationRegistrationStatus } from '../features/notification/notification.types';
import { registerDeviceForPush, subscribeToTokenRefresh } from '../services/notificationService';

type RegistrationState = {
  uid: string;
  status: NotificationRegistrationStatus;
};

export function useNotificationRegistration(): { status: NotificationRegistrationStatus } {
  const session = useAuthSession();
  const uid = session?.status === 'authenticated' ? session.profile.uid : null;
  const [state, setState] = useState<RegistrationState | null>(null);

  useEffect(() => {
    if (!uid) return;

    let active = true;
    let removeRefreshListener: (() => void) | null = null;

    void registerDeviceForPush(uid).then((result) => {
      if (!active) return;

      setState({ uid, status: result.status });
      if (result.ok && result.status === 'granted') {
        removeRefreshListener = subscribeToTokenRefresh(uid, (refreshResult) => {
          if (active) setState({ uid, status: refreshResult.status });
        });
      }
    });

    return () => {
      active = false;
      removeRefreshListener?.();
    };
  }, [uid]);

  const status: NotificationRegistrationStatus = !uid
    ? 'idle'
    : state?.uid === uid
      ? state.status
      : 'loading';

  return { status };
}
