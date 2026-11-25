import type { CurrentUser } from '../lib/currentSession';
import {
  ATTENDANCE_ALREADY_CHECKED_IN_REASON,
  ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
  ATTENDANCE_IDENTITY_INVALID_REASON,
  ATTENDANCE_SESSION_NOT_OPEN_REASON,
  buildAttendanceEnrollmentScope,
  checkEnrollmentEligibility,
  createAttendanceService,
  getAttendanceDocId,
  isDummyPraktikanId,
  isSessionEnrolled,
  type AttendanceRecord,
} from '../services/attendanceService';
import type { PracticumSession } from '../types';

const andi: CurrentUser = {
  uid: 'p1',
  name: 'Andi Pratama',
  email: 'andi.pratama@students.undip.ac.id',
  role: 'praktikan',
  studentCode: '24060124120001',
};

const budi: CurrentUser = {
  uid: 'p2',
  name: 'Budi Santoso',
  email: 'budi.santoso@students.undip.ac.id',
  role: 'praktikan',
  studentCode: '24060124120002',
};

const fixedNow = new Date('2026-11-15T09:30:00+07:00');

function makeService(currentUser: CurrentUser | null = budi) {
  return createAttendanceService({
    mode: 'mock',
    getCurrentUser: () => currentUser,
    now: () => fixedNow,
  });
}

describe('getAttendanceDocId', () => {
  it('uses a deterministic session+user document id', () => {
    expect(getAttendanceDocId('s5', 'p1')).toBe('s5_p1');
  });
});

describe('isDummyPraktikanId', () => {
  it('only flags local demo ids p1..p31', () => {
    expect(isDummyPraktikanId('p1')).toBe(true);
    expect(isDummyPraktikanId('p31')).toBe(true);
    expect(isDummyPraktikanId('pX1')).toBe(false);
    expect(isDummyPraktikanId('Xk29fJ2mQ1')).toBe(false);
  });
});

describe('attendanceService (mock mode)', () => {
  it('lets an assistant open a terjadwal session (SRS-08)', async () => {
    const service = makeService();
    let session: PracticumSession | null = null;
    const unsubscribe = service.subscribeToSession('s6', (record) => {
      session = record;
    });

    const result = await service.openSession('s6');

    expect(result).toEqual({ ok: true });
    expect(session).not.toBeNull();
    expect((session as PracticumSession | null)?.status).toBe('dibuka');
    unsubscribe();
  });

  it('lets an assistant close a dibuka session (SRS-08)', async () => {
    const service = makeService();
    let session: PracticumSession | null = null;
    const unsubscribe = service.subscribeToSession('s5', (record) => {
      session = record;
    });

    const result = await service.closeSession('s5');

    expect(result).toEqual({ ok: true });
    expect((session as PracticumSession | null)?.status).toBe('ditutup');
    unsubscribe();
  });

  it('rejects opening a sesi that is already closed', async () => {
    const service = makeService();

    await expect(service.openSession('s4')).resolves.toEqual({
      ok: false,
      reason: 'Sesi yang sudah ditutup tidak dapat dibuka kembali.',
    });
  });

  it('lets a praktikan check in while the sesi is dibuka (SRS-09)', async () => {
    const service = makeService();
    const records: AttendanceRecord[] = [];
    const unsubscribe = service.subscribeToAttendance('s5', (data) => {
      records.length = 0;
      records.push(...data);
    });

    const result = await service.checkIn('s5', budi);

    expect(result).toEqual({ ok: true });
    const budiRecords = records.filter((record) => record.praktikanId === 'p2');
    expect(budiRecords).toHaveLength(1);
    expect(budiRecords[0]).toMatchObject({
      id: 's5_p2',
      sessionId: 's5',
      praktikanId: 'p2',
      praktikanName: 'Budi Santoso',
      attendedAt: fixedNow.toISOString(),
      status: 'hadir',
    });
    unsubscribe();
  });

  it('rejects check-in before the sesi is opened', async () => {
    const service = makeService();

    await expect(service.checkIn('s6', budi)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_SESSION_NOT_OPEN_REASON,
    });
  });

  it('rejects check-in after the sesi is closed', async () => {
    const service = makeService();

    await expect(service.checkIn('s4', budi)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_SESSION_NOT_OPEN_REASON,
    });
  });

  it('rejects a duplicate check-in on the same sesi (SRS-11)', async () => {
    const service = makeService();
    const records: AttendanceRecord[] = [];
    const unsubscribe = service.subscribeToAttendance('s5', (data) => {
      records.length = 0;
      records.push(...data);
    });

    await expect(service.checkIn('s5', budi)).resolves.toEqual({ ok: true });
    await expect(service.checkIn('s5', budi)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_ALREADY_CHECKED_IN_REASON,
    });
    expect(records.filter((record) => record.praktikanId === 'p2')).toHaveLength(1);
    unsubscribe();
  });

  it('rejects a check-in made on behalf of another user', async () => {
    const service = makeService(andi);

    await expect(service.checkIn('s5', budi)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
  });

  it('rejects check-in when there is no authenticated identity', async () => {
    const service = makeService(andi);

    await expect(service.checkIn('s5', null)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
  });

  it('rejects check-in when the current identity is unavailable', async () => {
    const service = makeService(null);

    await expect(service.checkIn('s5', budi)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
  });

  it('rejects check-in when the identity has no name', async () => {
    const nameless: CurrentUser = { ...budi, name: '   ' };
    const service = makeService(nameless);

    await expect(service.checkIn('s5', nameless)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
  });

  it('rejects check-in from a non-praktikan role', async () => {
    const assistant: CurrentUser = { ...andi, role: 'asisten' };
    const service = makeService(assistant);

    await expect(service.checkIn('s5', assistant)).resolves.toEqual({
      ok: false,
      reason: 'Hanya praktikan yang dapat melakukan presensi.',
    });
  });

  it('rejects a new check-in once the assistant closes the sesi', async () => {
    const service = makeService();

    await expect(service.openSession('s6')).resolves.toEqual({ ok: true });
    await expect(service.closeSession('s6')).resolves.toEqual({ ok: true });
    await expect(service.checkIn('s6', budi)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_SESSION_NOT_OPEN_REASON,
    });
  });

  it('allows another praktikan to check in on the same open sesi', async () => {
    let currentUser: CurrentUser = budi;
    const service = createAttendanceService({
      mode: 'mock',
      getCurrentUser: () => currentUser,
      now: () => fixedNow,
    });

    await expect(service.openSession('s6')).resolves.toEqual({ ok: true });
    await expect(service.checkIn('s6', budi)).resolves.toEqual({ ok: true });

    currentUser = andi;
    await expect(service.checkIn('s6', andi)).resolves.toEqual({ ok: true });

    const records: AttendanceRecord[] = [];
    const unsubscribe = service.subscribeToAttendance('s6', (data) => {
      records.push(...data);
    });

    expect(records.map((record) => record.praktikanId).sort()).toEqual(['p1', 'p2']);
    unsubscribe();
  });

  it('notifies the realtime listener when attendance changes (SRS-10)', async () => {
    const service = makeService();
    const snapshots: AttendanceRecord[][] = [];
    const unsubscribe = service.subscribeToAttendance('s5', (data) => {
      snapshots.push(data);
    });

    const initialCount = snapshots[0].length;
    await service.checkIn('s5', budi);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toHaveLength(initialCount + 1);
    expect(snapshots[1].some((record) => record.praktikanId === 'p2')).toBe(true);
    unsubscribe();
  });

  it('stops sending updates after unsubscribe', async () => {
    const service = makeService();
    const snapshots: AttendanceRecord[][] = [];
    const unsubscribe = service.subscribeToAttendance('s5', (data) => {
      snapshots.push(data);
    });

    unsubscribe();
    await service.checkIn('s5', budi);

    expect(snapshots).toHaveLength(1);
  });

  it('notifies session and session-list listeners after open/close', async () => {
    const service = makeService();
    const sessions: PracticumSession[][] = [];
    const unsubscribe = service.subscribeToSessions((data) => {
      sessions.push(data);
    });

    await service.openSession('s6');
    await service.closeSession('s6');

    const latest = sessions[sessions.length - 1];
    expect(latest.find((session) => session.id === 's6')?.status).toBe('ditutup');
    unsubscribe();
  });

  it('streams every attendance record across sessions (SRS-10)', async () => {
    const service = makeService();
    const snapshots: AttendanceRecord[][] = [];
    const unsubscribe = service.subscribeToAllAttendance((data) => {
      snapshots.push(data);
    });

    const initialCount = snapshots[0].length;
    expect(snapshots[0].every((record) => typeof record.sessionId === 'string')).toBe(true);

    await service.checkIn('s5', budi);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toHaveLength(initialCount + 1);
    expect(snapshots[1].some((record) => record.id === 's5_p2')).toBe(true);
    unsubscribe();
  });

  it('sorts all-attendance records by attendedAt', () => {
    const service = makeService();
    let records: AttendanceRecord[] = [];
    const unsubscribe = service.subscribeToAllAttendance((data) => {
      records = data;
    });

    const timestamps = records.map((record) => record.attendedAt);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a.localeCompare(b)));
    unsubscribe();
  });

  it('stops sending all-attendance updates after unsubscribe', async () => {
    const service = makeService();
    const snapshots: AttendanceRecord[][] = [];
    const unsubscribe = service.subscribeToAllAttendance((data) => {
      snapshots.push(data);
    });

    unsubscribe();
    await service.checkIn('s5', budi);

    expect(snapshots).toHaveLength(1);
  });
});

describe('attendance enrollment scope', () => {
  it('treats an empty enrollment list as unverified, not as every session', () => {
    const scope = buildAttendanceEnrollmentScope([]);

    expect(scope.verified).toBe(false);
    expect(scope.sessionIds).toEqual([]);
    expect(isSessionEnrolled(scope, 's5')).toBe(false);
    expect(isSessionEnrolled(scope, 's6')).toBe(false);
  });

  it('rejects check-in eligibility when enrollment is unknown', () => {
    const scope = buildAttendanceEnrollmentScope([]);

    expect(checkEnrollmentEligibility(scope, 's5')).toEqual({
      ok: false,
      reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
    });
  });

  it('allows only sessions inside a verified enrollment scope', () => {
    const scope = buildAttendanceEnrollmentScope(['s5', 's6']);

    expect(scope.verified).toBe(true);
    expect(isSessionEnrolled(scope, 's5')).toBe(true);
    expect(isSessionEnrolled(scope, 's6')).toBe(true);
    expect(isSessionEnrolled(scope, 's1')).toBe(false);
    expect(checkEnrollmentEligibility(scope, 's5')).toEqual({ ok: true });
    expect(checkEnrollmentEligibility(scope, 's1')).toEqual({
      ok: false,
      reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
    });
  });

  it('does not mutate the enrollment source array', () => {
    const source = ['s5'];

    const scope = buildAttendanceEnrollmentScope(source);

    expect(source).toEqual(['s5']);
    expect(scope.sessionIds).not.toBe(source);
  });
});
