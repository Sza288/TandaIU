import {
  DEVICE_INSTALLATION_ID_STORAGE_KEY,
  DEVICE_PUSH_TOKEN_COLLECTION,
  buildDeviceTokenDocId,
  buildDeviceTokenPayload,
  createNotificationRegistrationResult,
  isValidDeviceInstallationId,
  isValidPushToken,
  normalizeNotificationPlatform,
  shouldSkipNotificationRegistration,
} from './notification.utils';

describe('notification utils', () => {
  it('normalizes supported platforms', () => {
    expect(normalizeNotificationPlatform('android')).toBe('android');
    expect(normalizeNotificationPlatform(' iOS ')).toBe('ios');
    expect(normalizeNotificationPlatform('WEB')).toBe('web');
    expect(normalizeNotificationPlatform('windows')).toBeNull();
  });

  it('validates installation ids for device-based token docs', () => {
    expect(isValidDeviceInstallationId('A1b2C3d4E5f6G7h8')).toBe(true);
    expect(isValidDeviceInstallationId('short-id')).toBe(false);
    expect(isValidDeviceInstallationId('bad id with spaces')).toBe(false);
    expect(isValidDeviceInstallationId('bad/id')).toBe(false);
  });

  it('builds device token doc id from installation id only', () => {
    expect(buildDeviceTokenDocId('device-installation-123456')).toBe('device-installation-123456');
    expect(buildDeviceTokenDocId('  trimmed-installation-id  ')).toBe('trimmed-installation-id');
    expect(buildDeviceTokenDocId('short')).toBeNull();
  });

  it('validates push tokens', () => {
    expect(isValidPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isValidPushToken('')).toBe(false);
    expect(isValidPushToken('   ')).toBe(false);
  });

  it('builds device token payload and overwrites ownership by device doc', () => {
    const payload = buildDeviceTokenPayload({
      uid: 'user-a',
      token: 'token-1',
      platform: 'android',
      updatedAt: 'SERVER_TIMESTAMP_SENTINEL',
      createdAt: 'SERVER_TIMESTAMP_SENTINEL',
      appOwnership: 'standalone',
    });

    expect(payload).toEqual({
      uid: 'user-a',
      token: 'token-1',
      platform: 'android',
      updatedAt: 'SERVER_TIMESTAMP_SENTINEL',
      createdAt: 'SERVER_TIMESTAMP_SENTINEL',
      appOwnership: 'standalone',
    });

    expect(
      buildDeviceTokenPayload({
        uid: 'user-b',
        token: 'token-2',
        platform: 'android',
        updatedAt: 'SERVER_TIMESTAMP_SENTINEL',
      }),
    ).toMatchObject({
      uid: 'user-b',
      token: 'token-2',
      platform: 'android',
    });
  });

  it('rejects invalid token payload input', () => {
    expect(
      buildDeviceTokenPayload({
        uid: '',
        token: 'token-1',
        platform: 'android',
        updatedAt: 'SERVER_TIMESTAMP_SENTINEL',
      }),
    ).toBeNull();
    expect(
      buildDeviceTokenPayload({
        uid: 'user-a',
        token: ' ',
        platform: 'android',
        updatedAt: 'SERVER_TIMESTAMP_SENTINEL',
      }),
    ).toBeNull();
  });

  it('creates registration results', () => {
    expect(createNotificationRegistrationResult(true, 'granted', { token: 'abc' })).toEqual({
      ok: true,
      status: 'granted',
      token: 'abc',
    });
    expect(createNotificationRegistrationResult(false, 'denied', { reason: 'Izin ditolak' })).toEqual({
      ok: false,
      status: 'denied',
      reason: 'Izin ditolak',
    });
  });

  it('skips registration when user is not authenticated or platform unsupported', () => {
    expect(shouldSkipNotificationRegistration({ isAuthenticated: false, platform: 'android' })).toBe(true);
    expect(shouldSkipNotificationRegistration({ isAuthenticated: true, platform: 'windows' })).toBe(true);
    expect(shouldSkipNotificationRegistration({ isAuthenticated: true, platform: 'ios' })).toBe(false);
  });

  it('exposes stable notification constants', () => {
    expect(DEVICE_PUSH_TOKEN_COLLECTION).toBe('deviceTokens');
    expect(DEVICE_INSTALLATION_ID_STORAGE_KEY).toBe('tandaiu.notification.installationId');
  });
});
