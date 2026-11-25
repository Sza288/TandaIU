import type { Attendance } from '../types';
import { haversineMeters, isValidCoordinate, MAX_LOCATION_ACCURACY_METERS } from './location';

export type AttendancePosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export type AttendanceLaboratoryLocation = {
  latitude: number;
  longitude: number;
  radius: number;
};

export type AttendanceDistanceResult =
  | { ok: true; distanceMeters: number; radiusMeters: number }
  | { ok: false; reason: string };

export function validateAttendancePosition(
  position: AttendancePosition,
): { ok: true } | { ok: false; reason: string } {
  if (!isValidCoordinate(position.latitude, position.longitude)) {
    return { ok: false, reason: 'Koordinat perangkat tidak valid.' };
  }
  if (!Number.isFinite(position.accuracyMeters)
    || position.accuracyMeters < 0
    || position.accuracyMeters > MAX_LOCATION_ACCURACY_METERS) {
    return { ok: false, reason: 'Akurasi lokasi harus 50 meter atau lebih baik.' };
  }
  return { ok: true };
}

export function measureAttendanceDistance(
  position: AttendancePosition,
  laboratory: AttendanceLaboratoryLocation,
): AttendanceDistanceResult {
  const validPosition = validateAttendancePosition(position);
  if (!validPosition.ok) return validPosition;
  if (!isValidCoordinate(laboratory.latitude, laboratory.longitude)) {
    return { ok: false, reason: 'Koordinat laboratorium tidak valid.' };
  }
  if (!Number.isInteger(laboratory.radius) || laboratory.radius < 1 || laboratory.radius > 500) {
    return { ok: false, reason: 'Radius laboratorium tidak valid.' };
  }

  const exactDistanceMeters = haversineMeters(
    position.latitude,
    position.longitude,
    laboratory.latitude,
    laboratory.longitude,
  );
  const distanceMeters = Math.round(exactDistanceMeters * 10) / 10;
  if (exactDistanceMeters > laboratory.radius) {
    return {
      ok: false,
      reason: `Lokasi berada ${Math.round(distanceMeters)} meter dari laboratorium. Radius yang diperbolehkan ${laboratory.radius} meter.`,
    };
  }
  return {
    ok: true,
    distanceMeters,
    radiusMeters: laboratory.radius,
  };
}

export function isAttendanceLocationVerified(
  attendance: Pick<
    Attendance,
    | 'status'
    | 'laboratoryId'
    | 'laboratoryName'
    | 'latitude'
    | 'longitude'
    | 'distanceMeters'
    | 'radiusMeters'
    | 'accuracyMeters'
  >,
): boolean {
  return attendance.status === 'hadir'
    && Boolean(attendance.laboratoryId?.trim())
    && Boolean(attendance.laboratoryName?.trim())
    && typeof attendance.latitude === 'number'
    && Number.isFinite(attendance.latitude)
    && attendance.latitude >= -90
    && attendance.latitude <= 90
    && typeof attendance.longitude === 'number'
    && Number.isFinite(attendance.longitude)
    && attendance.longitude >= -180
    && attendance.longitude <= 180
    && typeof attendance.distanceMeters === 'number'
    && Number.isFinite(attendance.distanceMeters)
    && attendance.distanceMeters >= 0
    && typeof attendance.radiusMeters === 'number'
    && Number.isFinite(attendance.radiusMeters)
    && attendance.radiusMeters > 0
    && attendance.distanceMeters <= attendance.radiusMeters
    && typeof attendance.accuracyMeters === 'number'
    && Number.isFinite(attendance.accuracyMeters)
    && attendance.accuracyMeters >= 0
    && attendance.accuracyMeters <= 50;
}
