import { Attendance } from '../types';
import { getPraktikanIdsForSession } from './sessionEnrollments';
import { initialSessions } from './sessions';

/**
 * Presensi demo awal. Setiap pasangan sessionId + praktikanId hanya muncul
 * sekali agar konsisten dengan aturan pencegahan presensi ganda di FR-12.
 */
const attendanceSeed: Attendance[] = [
  { sessionId: 's1', praktikanId: 'p1', attendedAt: '2026-10-20T10:12:00+07:00' },
  { sessionId: 's1', praktikanId: 'p2', attendedAt: '2026-10-20T10:15:00+07:00' },
  { sessionId: 's1', praktikanId: 'p3', attendedAt: '2026-10-20T10:21:00+07:00' },

  { sessionId: 's2', praktikanId: 'p1', attendedAt: '2026-10-21T13:04:00+07:00' },
  { sessionId: 's2', praktikanId: 'p4', attendedAt: '2026-10-21T13:09:00+07:00' },

  { sessionId: 's3', praktikanId: 'p2', attendedAt: '2026-10-22T09:42:00+07:00' },
  { sessionId: 's3', praktikanId: 'p3', attendedAt: '2026-10-22T09:47:00+07:00' },
  { sessionId: 's3', praktikanId: 'p5', attendedAt: '2026-10-22T09:51:00+07:00' },
  { sessionId: 's3', praktikanId: 'p6', attendedAt: '2026-10-22T09:58:00+07:00' },

  { sessionId: 's4', praktikanId: 'p1', attendedAt: '2026-10-26T08:05:00+07:00' },

];

const demoAttendanceTargets: Record<string, { hadir: number; izin: number }> = {
  s1: { hadir: 20, izin: 3 },
  s2: { hadir: 19, izin: 3 },
  s3: { hadir: 18, izin: 3 },
  s4: { hadir: 22, izin: 2 },
};

function createDemoAttendance(): Attendance[] {
  return Object.entries(demoAttendanceTargets).flatMap(([sessionId, target]) => {
    const enrolledIds = getPraktikanIdsForSession(sessionId);
    const existing = attendanceSeed.filter((attendance) => attendance.sessionId === sessionId);
    const existingHadir = existing.filter((attendance) => attendance.status !== 'izin');
    const existingIds = new Set(existing.map((attendance) => attendance.praktikanId));
    const session = initialSessions.find((item) => item.id === sessionId);
    if (!session) return [];

    const meetingStart = new Date(session.startsAt);
    const newHadirIds = enrolledIds
      .filter((praktikanId) => !existingIds.has(praktikanId))
      .slice(0, Math.max(0, target.hadir - existingHadir.length));
    const hadirIds = new Set([...existingHadir.map((item) => item.praktikanId), ...newHadirIds]);
    const newIzinIds = enrolledIds
      .filter((praktikanId) => !existingIds.has(praktikanId) && !hadirIds.has(praktikanId))
      .slice(0, target.izin);

    const newHadir = newHadirIds.map((praktikanId, index) => {
      const attendedAt = new Date(meetingStart);
      attendedAt.setMinutes(attendedAt.getMinutes() + index + 10);
      return {
        sessionId,
        praktikanId,
        attendedAt: attendedAt.toISOString(),
        status: 'hadir' as const,
      };
    });
    const newIzin = newIzinIds.map((praktikanId, index) => {
      const recordedAt = new Date(meetingStart);
      recordedAt.setMinutes(recordedAt.getMinutes() + 40 + index);
      return {
        sessionId,
        praktikanId,
        attendedAt: recordedAt.toISOString(),
        status: 'izin' as const,
        excuseReason: index % 2 === 0 ? 'sakit' as const : 'izin-lainnya' as const,
      };
    });

    return [...newHadir, ...newIzin];
  });
}

export const initialAttendances: Attendance[] = [
  ...attendanceSeed,
  ...createDemoAttendance(),
];
