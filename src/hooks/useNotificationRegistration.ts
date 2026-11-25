import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import type {
  NotificationRegistrationResult,
  NotificationRegistrationStatus,
} from '../features/notification/notification.types';
import { registerDeviceForPush, subscribeToTokenRefresh } from '../services/notificationService';
import { getErrorKind, getErrorMessage } from '../utils/errorMessage';

type RegistrationState = {
  uid: string;
  status: NotificationRegistrationStatus;
  reason: string | null;
};

export type UseNotificationRegistrationResult = {
  status: NotificationRegistrationStatus;
  reason: string | null;
  retry: () => void;
};

export function useNotificationRegistration(): UseNotificationRegistrationResult {
  const session = useAuthSession();
  const uid = session?.status === 'authenticated' ? session.profile.uid : null;
  const [state, setState] = useState<RegistrationState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!uid) return;

    let active = true;
    let removeRefreshListener: (() => void) | null = null;

    const applyResult = (result: NotificationRegistrationResult) => {
      if (!active) return;

      setState({
        uid,
        status: result.status,
        reason: result.ok ? null : result.reason,
      });
    };

    void registerDeviceForPush(uid)
      .then((result) => {
        applyResult(result);
        if (!active || !result.ok || result.status !== 'granted') return;

        removeRefreshListener = subscribeToTokenRefresh(uid, applyResult);
      })
      .catch((error: unknown) => {
        if (!active) return;

        setState({
          uid,
          status: 'error',
          reason: getErrorMessage(getErrorKind(error)).message,
        });
      });

    return () => {
      active = false;
      removeRefreshListener?.();
    };
  }, [uid, reloadKey]);

  const retry = useCallback(() => {
    setState(null);
    setReloadKey((value) => value + 1);
  }, []);

  const stateForUid = state?.uid === uid ? state : null;
  const status: NotificationRegistrationStatus = !uid
    ? 'idle'
    : stateForUid
      ? stateForUid.status
      : 'loading';
  const reason: string | null = !uid ? null : stateForUid?.reason ?? null;

  return { status, reason, retry };
}
