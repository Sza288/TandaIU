import type { Attendance } from '../types';

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
