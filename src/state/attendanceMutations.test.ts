import { initialSessions } from '../data/sessions';
import {
  applyCheckIn,
  applyCloseSession,
  applyMarkExcused,
  applyOpenSession,
} from './attendanceMutations';

const terjadwal = initialSessions.find((session) => session.id === 's6')!;
const dibuka = initialSessions.find((session) => session.id === 's5')!;
const ditutup = initialSessions.find((session) => session.id === 's4')!;

const P1 = 'p1';
const P5 = 'p5';

describe('applyOpenSession (FR-04 / AT-02)', () => {
  it('opens a terjadwal session', () => {
    const { result, sessions } = applyOpenSession([terjadwal], 's6');

    expect(result).toEqual({ ok: true });
    expect(sessions[0].status).toBe('dibuka');
  });

  it('does not mutate the input when opening fails', () => {
    const { result, sessions } = applyOpenSession([dibuka], 's5');

    expect(result.ok).toBe(false);
    expect(sessions[0].status).toBe('dibuka');
  });

  it('rejects an unknown session', () => {
    expect(applyOpenSession([terjadwal], 'missing').result.ok).toBe(false);
  });
});

describe('applyCloseSession (FR-05 / AT-07)', () => {
  it('closes a dibuka session', () => {
    const { result, sessions } = applyCloseSession([dibuka], 's5');

    expect(result.ok).toBe(true);
    expect(sessions[0].status).toBe('ditutup');
  });

  it('rejects closing a session that is not dibuka', () => {
    expect(applyCloseSession([terjadwal], 's6').result.ok).toBe(false);
    expect(applyCloseSession([ditutup], 's4').result.ok).toBe(false);
  });
});

describe('applyCheckIn (FR-06 / FR-07 / AT-03 / AT-04)', () => {
  it('records presence when the session is dibuka', () => {
    const { result, attendances } = applyCheckIn(
      [dibuka],
      [],
      's5',
      P1,
      '2026-10-27T08:05:00+07:00',
    );

    expect(result.ok).toBe(true);
    expect(attendances).toEqual([
      {
        sessionId: 's5',
        praktikanId: P1,
        attendedAt: '2026-10-27T08:05:00+07:00',
        status: 'hadir',
      },
    ]);
  });

  it('rejects presence when the session is not dibuka', () => {
    expect(applyCheckIn([terjadwal], [], 's6', P1).result.ok).toBe(false);
    expect(applyCheckIn([ditutup], [], 's4', P1).result.ok).toBe(false);
  });

  it('rejects an unknown praktikan identity', () => {
    expect(applyCheckIn([dibuka], [], 's5', 'ghost').result.ok).toBe(false);
  });

  it('rejects a praktikan that is not enrolled in the session', () => {
    expect(applyCheckIn([dibuka], [], 's5', 'p6').result.ok).toBe(false);
  });

  it('prevents duplicate presence for the same praktikan and session', () => {
    const first = applyCheckIn([dibuka], [], 's5', P1);
    const second = applyCheckIn([dibuka], first.attendances, 's5', P1);

    expect(second.result.ok).toBe(false);
    expect(second.attendances).toHaveLength(1);
  });

  it('allows a different praktikan to check in on the same session', () => {
    const first = applyCheckIn([dibuka], [], 's5', P1);
    const second = applyCheckIn([dibuka], first.attendances, 's5', P5);

    expect(second.result.ok).toBe(true);
    expect(second.attendances).toHaveLength(2);
  });
});

describe('applyMarkExcused (izin)', () => {
  it('records an izin attendance for an enrolled praktikan', () => {
    const { result, attendances } = applyMarkExcused(
      [dibuka],
      [],
      's5',
      P1,
      'sakit',
      '2026-10-27T08:10:00+07:00',
    );

    expect(result.ok).toBe(true);
    expect(attendances).toEqual([
      {
        sessionId: 's5',
        praktikanId: P1,
        attendedAt: '2026-10-27T08:10:00+07:00',
        status: 'izin',
        excuseReason: 'sakit',
      },
    ]);
  });

  it('rejects an unknown praktikan or session', () => {
    expect(applyMarkExcused([dibuka], [], 's5', 'ghost', 'sakit').result.ok).toBe(false);
    expect(applyMarkExcused([], [], 'missing', P1, 'sakit').result.ok).toBe(false);
  });
});
