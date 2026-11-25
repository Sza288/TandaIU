import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import type {
  NotificationRegistrationResult,
  NotificationRegistrationStatus,
} from '../features/notification/notification.types';
import {
  logNotificationDebug,
  logNotificationError,
  publishNotificationRegistration,
  registerDeviceForPush,
  subscribeToNotificationRegistrationRetry,
  subscribeToTokenRefresh,
} from '../services/notificationService';
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
  logNotificationDebug('hook:invoked');
  const session = useAuthSession();
  const uid = session?.status === 'authenticated' ? session.profile.uid : null;
  logNotificationDebug('hook:uid', { available: Boolean(uid) });
  const [state, setState] = useState<RegistrationState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    logNotificationDebug('hook:effect', { hasUid: Boolean(uid), reloadKey });
    if (!uid) {
      logNotificationDebug('hook:effect:stop', { stage: 'uid-unavailable' });
      return;
    }

    let active = true;

    const applyResult = (result: NotificationRegistrationResult) => {
      if (!active) {
        logNotificationDebug('hook:result:ignored', { status: result.status });
        return;
      }

      logNotificationDebug('hook:result', {
        ok: result.ok,
        status: result.status,
        reason: result.ok ? null : result.reason,
      });
      setState({
        uid,
        status: result.status,
        reason: result.ok ? null : result.reason,
      });
    };

    logNotificationDebug('hook:subscribe');
    const removeRefreshListener = subscribeToTokenRefresh(uid, applyResult);

    logNotificationDebug('hook:register:start');
    void registerDeviceForPush(uid)
      .then(applyResult)
      .catch((error: unknown) => {
        logNotificationError('hook:register:error', error);
        if (!active) return;

        setState({
          uid,
          status: 'error',
          reason: getErrorMessage(getErrorKind(error)).message,
        });
      });

    return () => {
      logNotificationDebug('hook:cleanup');
      active = false;
      removeRefreshListener();
    };
  }, [uid, reloadKey]);

  const retry = useCallback(() => {
    logNotificationDebug('hook:retry');
    setState(null);
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => subscribeToNotificationRegistrationRetry(retry), [retry]);

  const stateForUid = state?.uid === uid ? state : null;
  const status: NotificationRegistrationStatus = !uid
    ? 'idle'
    : stateForUid
      ? stateForUid.status
      : 'loading';
  const reason: string | null = !uid ? null : stateForUid?.reason ?? null;

  useEffect(() => {
    publishNotificationRegistration({ status, reason });
  }, [status, reason]);

  return { status, reason, retry };
}
