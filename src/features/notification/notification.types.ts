export type NotificationPlatform = 'android' | 'ios' | 'web';

export type NotificationPermissionState =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'unsupported';

export type NotificationRegistrationStatus =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error';

export type DevicePushTokenRecord = {
  uid: string;
  token: string;
  platform: NotificationPlatform;
  updatedAt: unknown;
  createdAt?: unknown;
  appOwnership?: 'expo' | 'standalone' | 'guest' | 'unknown';
};

export type NotificationRegistrationResult =
  | { ok: true; status: NotificationRegistrationStatus; token?: string }
  | { ok: false; status: NotificationRegistrationStatus; reason: string };
