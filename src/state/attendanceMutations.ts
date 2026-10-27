import { praktikans } from '../data/praktikans';
import { Attendance, MutationResult, PracticumSession } from '../types';

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
    { sessionId, praktikanId, attendedAt },
  ];
  return { result: { ok: true }, attendances: nextAttendances };
}
