import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getLastNotificationResponse,
  type NotificationResponse,
} from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import { configureNotificationHandler } from '../features/notification/notificationForegroundHandler';
import { resolveNotificationNavigation } from '../features/notification/notificationRoute';

export function useNotificationNavigation(): void {
  const session = useAuthSession();
  const status = session?.status ?? 'loading';
  const role = session?.status === 'authenticated' ? session.profile.role : null;
  const pendingResponse = useRef<NotificationResponse | null>(null);
  const handledIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    configureNotificationHandler();

    const processResponse = (response: NotificationResponse) => {
      const decision = resolveNotificationNavigation({
        data: response.notification.request.content.data,
        role,
        isAuthenticated: status === 'authenticated',
      });

      if (decision.kind === 'defer') {
        pendingResponse.current = response;
        return;
      }
      pendingResponse.current = null;
      if (decision.kind !== 'navigate') return;

      try {
        router.push(decision.href as Href);
      } catch {
        return;
      }
    };

    const handleResponse = (response: NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (handledIds.current.has(identifier)) return;
      handledIds.current.add(identifier);
      processResponse(response);
    };

    if (status === 'authenticated') {
      const deferred = pendingResponse.current;
      if (deferred) processResponse(deferred);
    } else if (status === 'unauthenticated' || status === 'error') {
      pendingResponse.current = null;
    }

    const subscription = addNotificationResponseReceivedListener(handleResponse);
    const lastResponse = getLastNotificationResponse();
    if (lastResponse) {
      handleResponse(lastResponse);
      clearLastNotificationResponse();
    }

    return () => subscription.remove();
  }, [role, status]);
}
