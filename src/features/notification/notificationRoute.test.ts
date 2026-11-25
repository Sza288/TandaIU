import {
  NOTIFICATION_TYPES,
  parseNotificationPayload,
  resolveNotificationNavigation,
} from './notificationRoute';

function resolve(
  data: Record<string, unknown> | null | undefined,
  role: 'asisten' | 'praktikan' | null = 'praktikan',
  isAuthenticated = true,
) {
  return resolveNotificationNavigation({ data, role, isAuthenticated });
}

describe('notificationRoute', () => {
  it('mendefinisikan kontrak tipe payload', () => {
    expect(NOTIFICATION_TYPES).toEqual(['session_opened', 'schedule_changed', 'permit_result']);
  });

  it('memparse payload dikenal dan membuang ID tidak aman', () => {
    expect(parseNotificationPayload({ type: ' session_opened ', sessionId: ' sess_1-2 ' })).toEqual({
      type: 'session_opened',
      sessionId: 'sess_1-2',
    });
    expect(parseNotificationPayload({ type: 'permit_result', permitId: '../auth/login' })).toEqual({
      type: 'permit_result',
      permitId: null,
    });
    expect(parseNotificationPayload(null)).toEqual({ type: 'unknown' });
    expect(parseNotificationPayload([] as unknown as Record<string, unknown>)).toEqual({
      type: 'unknown',
    });
  });

  it('memetakan session_opened ke detail sesi', () => {
    expect(resolve({ type: 'session_opened', sessionId: 'sess123' })).toEqual({
      kind: 'navigate',
      href: '/schedule/sess123',
    });
    expect(resolve({ type: 'session_opened', sessionId: 'sess_1-2', classId: 'cls1' })).toEqual({
      kind: 'navigate',
      href: '/schedule/sess_1-2',
    });
  });

  it('mengarahkan session_opened dengan ID invalid ke daftar sesi', () => {
    const invalidIds = [undefined, '', '   ', '../auth/login', 'a/b', 123, 'x'.repeat(129)];
    for (const sessionId of invalidIds) {
      expect(resolve({ type: 'session_opened', sessionId })).toEqual({
        kind: 'navigate',
        href: '/schedule',
      });
    }
  });

  it('memetakan schedule_changed ke detail jadwal bila scheduleId valid', () => {
    expect(resolve({ type: 'schedule_changed', scheduleId: 'sch123' })).toEqual({
      kind: 'navigate',
      href: '/schedule/schedule/sch123',
    });
    expect(resolve({ type: 'schedule_changed', scheduleId: 'sch_1-2' })).toEqual({
      kind: 'navigate',
      href: '/schedule/schedule/sch_1-2',
    });
  });

  it('mengarahkan schedule_changed tanpa ID valid ke daftar jadwal', () => {
    const invalidIds = [undefined, '', '   ', '../auth/login', 'a/b', 123, 'x'.repeat(129)];
    for (const scheduleId of invalidIds) {
      expect(resolve({ type: 'schedule_changed', scheduleId })).toEqual({
        kind: 'navigate',
        href: '/schedule',
      });
    }
  });

  it('memetakan permit_result ke detail izin bila permitId valid', () => {
    expect(resolve({ type: 'permit_result', permitId: 'perm123' })).toEqual({
      kind: 'navigate',
      href: '/praktikan/permit/perm123',
    });
    expect(resolve({ type: 'permit_result', permitId: 'perm_1-2' })).toEqual({
      kind: 'navigate',
      href: '/praktikan/permit/perm_1-2',
    });
  });

  it('mengarahkan permit_result tanpa ID valid ke halaman pengajuan izin', () => {
    const invalidIds = [undefined, '', '   ', '../auth/login', 'a/b', 123, 'x'.repeat(129)];
    for (const permitId of invalidIds) {
      expect(resolve({ type: 'permit_result', permitId })).toEqual({
        kind: 'navigate',
        href: '/praktikan/permit',
      });
    }
  });

  it('mengabaikan permit_result untuk role asisten', () => {
    expect(resolve({ type: 'permit_result', permitId: 'perm123' }, 'asisten')).toEqual({
      kind: 'ignore',
    });
  });

  it('menunda navigasi saat sesi belum autentikasi atau role kosong', () => {
    expect(resolve({ type: 'session_opened', sessionId: 'sess123' }, 'praktikan', false)).toEqual({
      kind: 'defer',
    });
    expect(resolve({ type: 'schedule_changed' }, null, true)).toEqual({ kind: 'defer' });
    expect(resolve({ type: 'permit_result' }, 'asisten', false)).toEqual({ kind: 'defer' });
  });

  it('memakai fallback / untuk payload tidak dikenali tanpa crash', () => {
    expect(resolve({ type: 'unknown_type', sessionId: 'sess123' })).toEqual({
      kind: 'navigate',
      href: '/',
    });
    expect(resolve(null)).toEqual({ kind: 'navigate', href: '/' });
    expect(resolve(undefined, null, false)).toEqual({ kind: 'navigate', href: '/' });
  });
});
