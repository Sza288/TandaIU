import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  getNotificationRegistrationSnapshot,
  requestNotificationRegistrationRetry,
  subscribeToNotificationRegistration,
  type NotificationRegistrationSnapshot,
} from '../services/notificationService';
import {
  getNotificationStatusContent,
  type NotificationStatusContent,
} from '../features/notification/notification.status';

export type UseNotificationStatusResult = {
  content: NotificationStatusContent | null;
  retry: () => void;
};

export function useNotificationStatus(): UseNotificationStatusResult {
  const [snapshot, setSnapshot] = useState<NotificationRegistrationSnapshot>(
    getNotificationRegistrationSnapshot,
  );

  useEffect(() => subscribeToNotificationRegistration(setSnapshot), []);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState !== 'active' && nextState === 'active') {
        requestNotificationRegistrationRetry();
      }
      previousState = nextState;
    });

    return () => subscription.remove();
  }, []);

  const retry = useCallback(() => requestNotificationRegistrationRetry(), []);

  return { content: getNotificationStatusContent(snapshot), retry };
}
