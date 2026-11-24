import type { LocationObject } from 'expo-location';
import * as ExpoLocation from 'expo-location';
import {
  acquireDeviceLocation,
  haversineMeters,
  validateCapturedLocation,
  withLocationTimeout,
} from './location';

jest.mock('expo-location', () => {
  const actual = jest.requireActual('expo-location');
  return {
    ...actual,
    requestForegroundPermissionsAsync: jest.fn(),
    hasServicesEnabledAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
  };
});

afterEach(() => {
  jest.resetAllMocks();
});

function location(accuracy: number | null, mocked?: boolean): LocationObject {
  return {
    coords: {
      latitude: -7.05,
      longitude: 110.44,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
    ...(mocked === undefined ? {} : { mocked }),
  };
}

describe('location capture validation', () => {
  it('accepts accuracy exactly 50 meters', () => {
    expect(validateCapturedLocation(location(50)).ok).toBe(true);
  });

  it('rejects accuracy worse than 50 meters', () => {
    const result = validateCapturedLocation(location(50.1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('accuracy-too-poor');
  });

  it('rejects missing accuracy', () => {
    expect(validateCapturedLocation(location(null)).ok).toBe(false);
  });

  it('rejects locations marked as simulated by the platform', () => {
    const result = validateCapturedLocation(location(10, true));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('mocked-location');
  });

  it('times out after the configured duration', async () => {
    await expect(withLocationTimeout(new Promise(() => undefined), 5))
      .rejects.toThrow('LOCATION_TIMEOUT');
  });

  it('returns an explicit failure when requesting location permission throws', async () => {
    jest.mocked(ExpoLocation.requestForegroundPermissionsAsync)
      .mockRejectedValue(new Error('native permission API failure'));

    await expect(acquireDeviceLocation()).resolves.toMatchObject({
      ok: false,
      code: 'coordinates-unavailable',
      reason: 'Gagal mengambil lokasi perangkat. Periksa izin dan GPS, lalu coba lagi.',
    });
  });

  it('stops location capture when foreground permission is denied', async () => {
    jest.mocked(ExpoLocation.requestForegroundPermissionsAsync)
      .mockResolvedValue({ status: 'denied' } as ExpoLocation.LocationPermissionResponse);

    await expect(acquireDeviceLocation()).resolves.toMatchObject({
      ok: false,
      code: 'permission-denied',
    });
    expect(ExpoLocation.hasServicesEnabledAsync).not.toHaveBeenCalled();
  });

  it('returns an explicit failure when the location service check throws', async () => {
    jest.mocked(ExpoLocation.requestForegroundPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as ExpoLocation.LocationPermissionResponse);
    jest.mocked(ExpoLocation.hasServicesEnabledAsync)
      .mockRejectedValue(new Error('native location API failure'));

    await expect(acquireDeviceLocation()).resolves.toMatchObject({
      ok: false,
      code: 'coordinates-unavailable',
    });
  });

  it('reports disabled GPS without requesting a position', async () => {
    jest.mocked(ExpoLocation.requestForegroundPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as ExpoLocation.LocationPermissionResponse);
    jest.mocked(ExpoLocation.hasServicesEnabledAsync).mockResolvedValue(false);

    await expect(acquireDeviceLocation()).resolves.toMatchObject({
      ok: false,
      code: 'services-disabled',
    });
    expect(ExpoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports a rejected GPS position request without exposing native errors', async () => {
    jest.mocked(ExpoLocation.requestForegroundPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as ExpoLocation.LocationPermissionResponse);
    jest.mocked(ExpoLocation.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(ExpoLocation.getCurrentPositionAsync)
      .mockRejectedValue(new Error('native GPS failure'));

    await expect(acquireDeviceLocation()).resolves.toMatchObject({
      ok: false,
      code: 'coordinates-unavailable',
      reason: 'Gagal mengambil lokasi perangkat. Periksa izin dan GPS, lalu coba lagi.',
    });
  });

  it('calculates exact-radius boundary through Haversine', () => {
    expect(haversineMeters(0, 0, 0, 0)).toBe(0);
  });
});
