export const NOTIFICATION_TYPES = ['session_opened', 'schedule_changed', 'permit_result'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationData = Record<string, string>;

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isSafeNotificationId(value: unknown): boolean {
  return typeof value === 'string' && SAFE_ID_PATTERN.test(value.trim());
}

function readSafeId(value: unknown): string | null {
  if (!isSafeNotificationId(value)) return null;
  return (value as string).trim();
}

export function buildNotificationData(input: {
  type: NotificationType;
  sessionId?: unknown;
  scheduleId?: unknown;
  permitId?: unknown;
}): NotificationData {
  const data: NotificationData = { type: input.type };

  if (input.type === 'session_opened') {
    const sessionId = readSafeId(input.sessionId);
    if (sessionId) data.sessionId = sessionId;
    return data;
  }

  if (input.type === 'schedule_changed') {
    const scheduleId = readSafeId(input.scheduleId);
    if (scheduleId) data.scheduleId = scheduleId;
    return data;
  }

  const permitId = readSafeId(input.permitId);
  if (permitId) data.permitId = permitId;
  return data;
}
