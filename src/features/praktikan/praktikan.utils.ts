import { Attendance, PracticumSession } from '../../types';

export type NormalizedAttendance = Attendance & {
  status: 'hadir' | 'izin';
};

export type RiwayatRecord = {
  attendance: NormalizedAttendance;
  session?: PracticumSession;
};

export function deriveRiwayat(
  attendances: Attendance[],
  sessions: PracticumSession[],
  praktikanId: string | null,
): RiwayatRecord[] {
  if (!praktikanId) return [];

  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  return attendances
    .filter((attendance) => attendance.praktikanId === praktikanId)
    .map((attendance): RiwayatRecord => ({
      attendance: {
        ...attendance,
        status: attendance.status === 'izin' ? 'izin' : 'hadir',
      },
      session: sessionById.get(attendance.sessionId),
    }))
    .sort((a, b) => {
      const aTime = Date.parse(a.attendance.attendedAt);
      const bTime = Date.parse(b.attendance.attendedAt);
      const aValue = Number.isNaN(aTime) ? 0 : aTime;
      const bValue = Number.isNaN(bTime) ? 0 : bTime;
      return bValue - aValue;
    });
}

export function deriveOpenSessions(
  sessions: PracticumSession[],
  attendances: Attendance[],
  praktikanId: string | null,
  enrolledSessionIds: ReadonlySet<string>,
): PracticumSession[] {
  if (!praktikanId) return [];

  const handledSessionIds = new Set(
    attendances
      .filter((attendance) => attendance.praktikanId === praktikanId)
      .map((attendance) => attendance.sessionId),
  );

  return sessions
    .filter((session) =>
      session.status === 'dibuka'
      && enrolledSessionIds.has(session.id)
      && !handledSessionIds.has(session.id),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
