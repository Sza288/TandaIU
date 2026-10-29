import { praktikans } from '../data/praktikans';
import { getPraktikanIdsForSession } from '../data/sessionEnrollments';
import { Attendance, ExcuseReason, MutationResult, PracticumSession } from '../types';

type SessionMutation = {
  result: MutationResult;
  sessions: PracticumSession[];
};

type CheckInMutation = {
  result: MutationResult;
  attendances: Attendance[];
};

export function applyOpenSession(
  sessions: PracticumSession[],
  sessionId: string
): SessionMutation {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) {
    return { result: { ok: false, reason: 'Sesi tidak ditemukan.' }, sessions };
  }
  if (session.status !== 'terjadwal') {
    return {
      result: { ok: false, reason: 'Sesi hanya dapat dibuka jika berstatus terjadwal.' },
      sessions,
    };
  }
  if (sessions.some((item) => item.id !== sessionId && item.status === 'dibuka')) {
    return {
      result: {
        ok: false,
        reason: 'Tutup sesi yang sedang berlangsung sebelum membuka sesi lain.',
      },
      sessions,
    };
  }
  const nextSessions = sessions.map((item) =>
    item.id === sessionId ? { ...item, status: 'dibuka' as const } : item
  );
  return { result: { ok: true }, sessions: nextSessions };
}

export function applyCloseSession(
  sessions: PracticumSession[],
  sessionId: string
): SessionMutation {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) {
    return { result: { ok: false, reason: 'Sesi tidak ditemukan.' }, sessions };
  }
  if (session.status !== 'dibuka') {
    return {
      result: { ok: false, reason: 'Sesi hanya dapat ditutup jika berstatus dibuka.' },
      sessions,
    };
  }
  const nextSessions = sessions.map((item) =>
    item.id === sessionId ? { ...item, status: 'ditutup' as const } : item
  );
  return { result: { ok: true }, sessions: nextSessions };
}

export function applyCheckIn(
  sessions: PracticumSession[],
  attendances: Attendance[],
  sessionId: string,
  praktikanId: string,
  attendedAt: string = new Date().toISOString()
): CheckInMutation {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) {
    return { result: { ok: false, reason: 'Sesi tidak ditemukan.' }, attendances };
  }
  if (session.status !== 'dibuka') {
    return {
      result: { ok: false, reason: 'Presensi hanya dapat dilakukan saat sesi dibuka.' },
      attendances,
    };
  }
  if (!praktikanId || !praktikans.some((praktikan) => praktikan.id === praktikanId)) {
    return {
      result: { ok: false, reason: 'Identitas praktikan tidak ditemukan.' },
      attendances,
    };
  }
  if (!getPraktikanIdsForSession(sessionId).includes(praktikanId)) {
    return {
      result: { ok: false, reason: 'Praktikan tidak terdaftar pada sesi ini.' },
      attendances,
    };
  }
  const alreadyCheckedIn = attendances.some(
    (attendance) =>
      attendance.sessionId === sessionId && attendance.praktikanId === praktikanId
  );
  if (alreadyCheckedIn) {
    return {
      result: { ok: false, reason: 'Anda sudah melakukan presensi pada sesi ini.' },
      attendances,
    };
  }
  const nextAttendances = [
    ...attendances,
    { sessionId, praktikanId, attendedAt, status: 'hadir' as const },
  ];
  return { result: { ok: true }, attendances: nextAttendances };
}

export function applyMarkExcused(
  sessions: PracticumSession[],
  attendances: Attendance[],
  sessionId: string,
  praktikanId: string,
  excuseReason: ExcuseReason,
  recordedAt: string = new Date().toISOString(),
): CheckInMutation {
  if (!sessions.some((session) => session.id === sessionId)) {
    return { result: { ok: false, reason: 'Sesi tidak ditemukan.' }, attendances };
  }
  if (!praktikans.some((praktikan) => praktikan.id === praktikanId)) {
    return { result: { ok: false, reason: 'Identitas praktikan tidak ditemukan.' }, attendances };
  }
  if (!getPraktikanIdsForSession(sessionId).includes(praktikanId)) {
    return {
      result: { ok: false, reason: 'Praktikan tidak terdaftar pada sesi ini.' },
      attendances,
    };
  }

  const updatedAttendance: Attendance = {
    sessionId,
    praktikanId,
    attendedAt: recordedAt,
    status: 'izin',
    excuseReason,
  };
  const nextAttendances = attendances
    .filter((attendance) =>
      attendance.sessionId !== sessionId || attendance.praktikanId !== praktikanId,
    )
    .concat(updatedAttendance);

  return { result: { ok: true }, attendances: nextAttendances };
}
