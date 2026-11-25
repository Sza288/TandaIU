import type { LocationObject } from 'expo-location';
import * as ExpoLocation from 'expo-location';

export const MAX_LOCATION_ACCURACY_METERS = 50;
export const LOCATION_TIMEOUT_MS = 15_000;

export type LocationCaptureResult =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      accuracyMeters: number;
    }
  | {
      ok: false;
      reason: string;
      code:
        | 'permission-denied'
        | 'services-disabled'
        | 'timeout'
        | 'coordinates-unavailable'
        | 'accuracy-too-poor'
        | 'mocked-location';
    };

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function haversineMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadiusMeters = 6_371_000;
  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);
  const latDelta = toRadians(latitude2 - latitude1);
  const lonDelta = toRadians(longitude2 - longitude1);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export function validateCapturedLocation(location: LocationObject): LocationCaptureResult {
  if (location.mocked === true) {
    return {
      ok: false,
      code: 'mocked-location',
      reason: 'Lokasi simulasi terdeteksi. Gunakan lokasi perangkat yang sebenarnya untuk presensi.',
    }
  }

  const latitude = location.coords.latitude;
  const longitude = location.coords.longitude;
  const accuracyMeters = location.coords.accuracy;

  if (!isValidCoordinate(latitude, longitude)) {
    return {
      ok: false,
      code: 'coordinates-unavailable',
      reason: 'Koordinat lokasi tidak tersedia. Silakan aktifkan GPS dan coba lagi.',
    };
  }
  if (
    typeof accuracyMeters !== 'number'
    || !Number.isFinite(accuracyMeters)
    || accuracyMeters < 0
  ) {
    return {
      ok: false,
      code: 'coordinates-unavailable',
      reason: 'Akurasi lokasi tidak tersedia. Silakan coba mengambil lokasi lagi.',
    };
  }
  if (accuracyMeters > MAX_LOCATION_ACCURACY_METERS) {
    return {
      ok: false,
      code: 'accuracy-too-poor',
      reason: `Akurasi lokasi ${Math.round(accuracyMeters)} meter, melebihi batas 50 meter. Silakan coba lagi di area dengan sinyal GPS lebih baik.`,
    };
  }

  return {
    ok: true,
    latitude,
    longitude,
    accuracyMeters,
  };
}

export async function withLocationTimeout<T>(
  operation: Promise<T>,
  timeoutMs = LOCATION_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error('LOCATION_TIMEOUT')),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function acquireDeviceLocation(): Promise<LocationCaptureResult> {
  try {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return {
        ok: false,
        code: 'permission-denied',
        reason: 'Izin lokasi ditolak. Aktifkan izin lokasi TandaIU untuk melakukan presensi.',
      };
    }

    const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        ok: false,
        code: 'services-disabled',
        reason: 'Layanan lokasi perangkat mati. Aktifkan GPS/lokasi lalu coba lagi.',
      };
    }

    const location = await withLocationTimeout(
      ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      }),
    );
    return validateCapturedLocation(location);
  } catch (error) {
    if (error instanceof Error && error.message === 'LOCATION_TIMEOUT') {
      return {
        ok: false,
        code: 'timeout',
        reason: 'Pengambilan lokasi melebihi 15 detik. Silakan coba lagi.',
      };
    }
    return {
      ok: false,
      code: 'coordinates-unavailable',
      reason: 'Gagal mengambil lokasi perangkat. Periksa izin dan GPS, lalu coba lagi.',
    };
  }
}
