import type { UserRole } from '../auth/authTypes';

export const NOTIFICATION_TYPES = ['session_opened', 'schedule_changed', 'permit_result'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type ParsedNotificationPayload =
  | { type: 'session_opened'; sessionId: string | null }
  | { type: 'schedule_changed'; scheduleId: string | null }
  | { type: 'permit_result'; permitId: string | null }
  | { type: 'unknown' };

export type NotificationNavigationTarget =
  | { kind: 'navigate'; href: string }
  | { kind: 'defer' }
  | { kind: 'ignore' };

export type NotificationNavigationInput = {
  data?: Record<string, unknown> | null;
  role: UserRole | null;
  isAuthenticated: boolean;
};

function readSafeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(trimmed) ? trimmed : null;
}

export function parseNotificationPayload(
  data?: Record<string, unknown> | null,
): ParsedNotificationPayload {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { type: 'unknown' };

  const type = typeof data.type === 'string' ? data.type.trim() : '';
  if (type === 'session_opened') {
    return { type, sessionId: readSafeId(data.sessionId) };
  }
  if (type === 'schedule_changed') {
    return { type, scheduleId: readSafeId(data.scheduleId) };
  }
  if (type === 'permit_result') {
    return { type, permitId: readSafeId(data.permitId) };
  }
  return { type: 'unknown' };
}

function navigate(href: string): NotificationNavigationTarget {
  return { kind: 'navigate', href };
}

export function resolveNotificationNavigation(
  input: NotificationNavigationInput,
): NotificationNavigationTarget {
  const payload = parseNotificationPayload(input.data);
  if (payload.type === 'unknown') return navigate('/');
  if (!input.isAuthenticated || !input.role) return { kind: 'defer' };

  if (payload.type === 'session_opened') {
    return payload.sessionId
      ? navigate(`/schedule/${encodeURIComponent(payload.sessionId)}`)
      : navigate('/schedule');
  }
  if (payload.type === 'schedule_changed') {
    return payload.scheduleId
      ? navigate(`/schedule/schedule/${encodeURIComponent(payload.scheduleId)}`)
      : navigate('/schedule');
  }
  if (input.role !== 'praktikan') return { kind: 'ignore' };
  return payload.permitId
    ? navigate(`/praktikan/permit/${encodeURIComponent(payload.permitId)}`)
    : navigate('/praktikan/permit');
}
