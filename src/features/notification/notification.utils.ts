import type {
  DevicePushTokenRecord,
  NotificationPlatform,
  NotificationRegistrationResult,
  NotificationRegistrationStatus,
} from './notification.types';

export const DEVICE_PUSH_TOKEN_COLLECTION = 'deviceTokens';
export const DEVICE_INSTALLATION_ID_STORAGE_KEY = 'tandaiu.notification.installationId';

const NOTIFICATION_PLATFORMS: readonly NotificationPlatform[] = ['android', 'ios', 'web'];

export function normalizeNotificationPlatform(value: string): NotificationPlatform | null {
  const normalized = value.trim().toLowerCase();
  return NOTIFICATION_PLATFORMS.find((platform) => platform === normalized) ?? null;
}

export function isValidDeviceInstallationId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 16 && trimmed.length <= 128 && /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export function buildDeviceTokenDocId(installationId: string): string | null {
  const trimmed = installationId.trim();
  if (!isValidDeviceInstallationId(trimmed)) return null;
  return trimmed;
}

export function isValidPushToken(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 4096;
}

export function buildDeviceTokenPayload(input: {
  uid: string;
  token: string;
  platform: NotificationPlatform;
  updatedAt: unknown;
  createdAt?: unknown;
  appOwnership?: DevicePushTokenRecord['appOwnership'];
}): DevicePushTokenRecord | null {
  const uid = input.uid.trim();
  const token = input.token.trim();

  if (!uid || !isValidPushToken(token)) return null;

  return {
    uid,
    token,
    platform: input.platform,
    updatedAt: input.updatedAt,
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
    ...(input.appOwnership ? { appOwnership: input.appOwnership } : {}),
  };
}

export function createNotificationRegistrationResult(
  ok: boolean,
  status: NotificationRegistrationStatus,
  options?: { token?: string; reason?: string },
): NotificationRegistrationResult {
  if (ok) {
    return {
      ok: true,
      status,
      ...(options?.token ? { token: options.token } : {}),
    };
  }

  return {
    ok: false,
    status,
    reason: options?.reason?.trim() || 'Registrasi notifikasi gagal.',
  };
}

export function shouldSkipNotificationRegistration(input: {
  isAuthenticated: boolean;
  platform: string;
}): boolean {
  if (!input.isAuthenticated) return true;
  return normalizeNotificationPlatform(input.platform) === null;
}
