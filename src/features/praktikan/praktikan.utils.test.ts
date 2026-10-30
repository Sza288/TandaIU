import { Attendance, PracticumSession } from '../../types';
import { deriveOpenSessions, deriveRiwayat } from './praktikan.utils';

const sessions: PracticumSession[] = [
  {
    id: 's1',
    courseId: 'c1',
    practicumName: 'Praktikum A',
    className: 'A1',
    startsAt: '2026-10-27T08:00:00+07:00',
    endsAt: '2026-10-27T10:00:00+07:00',
    status: 'dibuka',
  },
  {
    id: 's2',
    courseId: 'c2',
    practicumName: 'Praktikum B',
    className: 'B1',
    startsAt: '2026-10-28T08:00:00+07:00',
    endsAt: '2026-10-28T10:00:00+07:00',
    status: 'dibuka',
  },
  {
    id: 's3',
    courseId: 'c3',
    practicumName: 'Praktikum C',
    className: 'C1',
    startsAt: '2026-10-29T08:00:00+07:00',
    endsAt: '2026-10-29T10:00:00+07:00',
    status: 'terjadwal',
  },
  {
    id: 's4',
    courseId: 'c4',
    practicumName: 'Praktikum D',
    className: 'D1',
    startsAt: '2026-10-30T08:00:00+07:00',
    endsAt: '2026-10-30T10:00:00+07:00',
    status: 'dibuka',
  },
];

const records: Attendance[] = [
  {
    sessionId: 's1',
    praktikanId: 'p1',
    attendedAt: '2026-10-27T08:05:00+07:00',
  },
  {
    sessionId: 's2',
    praktikanId: 'p1',
    attendedAt: '2026-10-28T08:05:00+07:00',
    status: 'hadir',
  },
  {
    sessionId: 's4',
    praktikanId: 'p1',
    attendedAt: '2026-10-30T08:05:00+07:00',
    status: 'izin',
    excuseReason: 'sakit',
  },
  {
    sessionId: 's3',
    praktikanId: 'p2',
    attendedAt: '2026-10-29T08:05:00+07:00',
    status: 'hadir',
  },
];

describe('deriveRiwayat', () => {
  it('returns an empty list when the identity is null', () => {
    expect(deriveRiwayat(records, sessions, null)).toEqual([]);
  });

  it('returns an empty list when the praktikan has no records', () => {
    expect(deriveRiwayat(records, sessions, 'p9')).toEqual([]);
  });

  it('orders the newest attendance first and joins the session', () => {
    const result = deriveRiwayat([records[0], records[1]], sessions, 'p1');

    expect(result.map((record) => record.attendance.sessionId)).toEqual(['s2', 's1']);
    expect(result[0].session?.id).toBe('s2');
  });

  it('treats a missing status as hadir', () => {
    const result = deriveRiwayat([records[0]], sessions, 'p1');

    expect(result[0].attendance.status).toBe('hadir');
  });

  it('preserves izin status and reason', () => {
    const result = deriveRiwayat([records[2]], sessions, 'p1');

    expect(result[0].attendance.status).toBe('izin');
    expect(result[0].attendance.excuseReason).toBe('sakit');
  });

  it('does not leak another praktikan records', () => {
    const result = deriveRiwayat(records, sessions, 'p1');

    expect(result).toHaveLength(3);
    expect(result.every((record) => record.attendance.praktikanId === 'p1')).toBe(true);
  });

  it('keeps a record when its session is missing', () => {
    const result = deriveRiwayat(
      [{
        sessionId: 'missing',
        praktikanId: 'p1',
        attendedAt: '2026-10-27T08:05:00+07:00',
      }],
      sessions,
      'p1',
    );

    expect(result).toHaveLength(1);
    expect(result[0].session).toBeUndefined();
  });
});

describe('deriveOpenSessions', () => {
  it('returns an empty list when the identity is null', () => {
    expect(deriveOpenSessions(sessions, [], null, new Set(['s1', 's2']))).toEqual([]);
  });

  it('returns open enrolled sessions when there are no attendance records', () => {
    const result = deriveOpenSessions(sessions, [], 'p1', new Set(['s1', 's2']));

    expect(result.map((session) => session.id)).toEqual(['s1', 's2']);
  });

  it('orders sessions by startsAt ascending', () => {
    const result = deriveOpenSessions(
      [sessions[1], sessions[0]],
      [],
      'p1',
      new Set(['s1', 's2']),
    );

    expect(result.map((session) => session.id)).toEqual(['s1', 's2']);
  });

  it('excludes open sessions that already have hadir or izin records', () => {
    const handled: Attendance[] = [
      {
        sessionId: 's1',
        praktikanId: 'p1',
        attendedAt: '2026-10-27T08:05:00+07:00',
        status: 'hadir',
      },
      {
        sessionId: 's2',
        praktikanId: 'p1',
        attendedAt: '2026-10-28T08:05:00+07:00',
        status: 'izin',
        excuseReason: 'izin-lainnya',
      },
    ];

    expect(deriveOpenSessions(sessions, handled, 'p1', new Set(['s1', 's2']))).toEqual([]);
  });

  it('excludes a session when a record has no status', () => {
    const result = deriveOpenSessions(
      sessions,
      [{
        sessionId: 's1',
        praktikanId: 'p1',
        attendedAt: '2026-10-27T08:05:00+07:00',
      }],
      'p1',
      new Set(['s1', 's2']),
    );

    expect(result.map((session) => session.id)).toEqual(['s2']);
  });

  it('does not exclude a session because another praktikan has a record', () => {
    const result = deriveOpenSessions(
      sessions,
      [{
        sessionId: 's1',
        praktikanId: 'p2',
        attendedAt: '2026-10-27T08:05:00+07:00',
        status: 'hadir',
      }],
      'p1',
      new Set(['s1', 's2']),
    );

    expect(result.map((session) => session.id)).toEqual(['s1', 's2']);
  });

  it('only returns sessions that are open and enrolled', () => {
    const result = deriveOpenSessions(
      sessions,
      [],
      'p1',
      new Set(['s1', 's3', 's4']),
    );

    expect(result.map((session) => session.id)).toEqual(['s1', 's4']);
  });
});
