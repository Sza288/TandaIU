import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import type { CurrentUser } from '../lib/currentSession';
import {
  ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
  createAttendanceService,
  type AttendanceRecord,
} from '../services/attendanceService';

const mockGetCurrentUser = jest.fn<CurrentUser, []>();

jest.mock('../lib/firebase', () => ({
  db: { name: 'fake-firestore' },
}));
jest.mock('../lib/currentSession', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  collection: jest.fn(),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server_timestamp_sentinel'),
  where: jest.fn(),
}));

const user: CurrentUser = {
  uid: 'u1',
  name: 'User Satu',
  email: 'user.satu@students.undip.ac.id',
  role: 'praktikan',
};

const assistant: CurrentUser = {
  uid: 'asst-1',
  name: 'Asisten Satu',
  email: 'asisten@example.test',
  role: 'asisten',
};

const fixedNow = new Date('2026-11-15T10:15:00+07:00');

const mockedCollection = jest.mocked(collection);
const mockedDoc = jest.mocked(doc);
const mockedOnSnapshot = jest.mocked(onSnapshot);
const mockedQuery = jest.mocked(query);
const mockedRunTransaction = jest.mocked(runTransaction);
const mockedWhere = jest.mocked(where);

function makeService(currentUser: CurrentUser | null = user) {
  return createAttendanceService({
    mode: 'firestore',
    database: {} as never,
    getCurrentUser: () => currentUser,
    now: () => fixedNow,
  });
}

function snapshot(data: Record<string, unknown> | null, id = '') {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? undefined,
  };
}

function profileSnapshot(role: 'praktikan' | 'asisten' = 'praktikan') {
  return snapshot({ name: 'User Satu Profil', role }, role === 'praktikan' ? 'u1' : 'asst-1');
}

function sessionSnapshot(status: string = 'dibuka', overrides: Record<string, unknown> = {}) {
  return snapshot({
    status,
    classId: 'class-1',
    className: 'A1',
    courseId: 'course-1',
    semester: 1,
    assistantUid: 'asst-1',
    laboratoryId: 'lab-1',
    startsAt: Timestamp.fromDate(new Date(fixedNow.getTime() - 15 * 60_000)),
    endsAt: Timestamp.fromDate(new Date(fixedNow.getTime() + 105 * 60_000)),
    practicumName: 'Praktikum Satu',
    ...overrides,
  }, 's5');
}

function classSnapshot() {
  return snapshot({ courseId: 'course-1', className: 'A1', semester: 1 }, 'class-1');
}

function enrollmentSnapshot(enrollment: Record<string, unknown> | null = {
    praktikanId: 'u1',
    classId: 'class-1',
    courseId: 'course-1',
    semester: 1,
  }) {
  return snapshot(enrollment, 'class-1_u1');
}

function laboratorySnapshot(overrides: Record<string, unknown> = {}) {
  return snapshot({
    name: 'Laboratorium Satu',
    latitude: -7.05,
    longitude: 110.44,
    radius: 500,
    ...overrides,
  }, 'lab-1');
}

function attendanceSnapshot(exists: boolean) {
  return snapshot(exists ? { status: 'hadir' } : null, 's5_u1');
}

function qrSnapshot(data: Record<string, unknown> | null = null) {
  return snapshot(data, 's5');
}

function makeTransaction(
  results: ReturnType<typeof snapshot>[],
) {
  const get = jest.fn();
  results.forEach((result) => get.mockResolvedValueOnce(result));
  return {
    get,
    update: jest.fn(),
    set: jest.fn(),
  };
}

function useTransaction(results: ReturnType<typeof snapshot>[]) {
  const transaction = makeTransaction(results);
  mockedRunTransaction.mockImplementationOnce(async (_database, updateFunction) =>
    updateFunction(transaction as never),
  );
  return transaction;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUser.mockReturnValue(user);
  mockedCollection.mockImplementation((_database, path) => ({ path } as never));
  mockedDoc.mockImplementation(((...args: unknown[]) => {
    if (args.length === 1) return { id: 'x'.repeat(20) } as never;
    return { path: `${String(args[1])}/${String(args[2])}`, id: args[2] } as never;
  }) as never);
  mockedQuery.mockImplementation((...args) => args as never);
  mockedWhere.mockImplementation(
    (field, operator, value) => ({ field, operator, value } as never),
  );
  mockedOnSnapshot.mockReturnValue(jest.fn());
});

describe('attendanceService (Firestore mode)', () => {
  it('opens a scheduled session through a Firestore transaction', async () => {
    const transaction = useTransaction([
      profileSnapshot('asisten'),
      sessionSnapshot('terjadwal'),
    ]);

    await expect(makeService(assistant).openSession('s5')).resolves.toEqual({ ok: true });
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/s5' }),
      { status: 'dibuka' },
    );
  });

  it('closes an open session and revokes its active QR atomically', async () => {
    const transaction = useTransaction([
      profileSnapshot('asisten'),
      sessionSnapshot(),
      qrSnapshot({ revokedAt: null }),
    ]);

    await expect(makeService(assistant).closeSession('s5')).resolves.toEqual({ ok: true });
    expect(transaction.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: 'sessions/s5' }),
      { status: 'ditutup' },
    );
    expect(transaction.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: 'attendanceQrTokens/s5' }),
      expect.objectContaining({ revokedBy: 'asst-1' }),
    );
  });

  it('creates an attendance record with measured distance and server timestamp', async () => {
    const transaction = useTransaction([
      profileSnapshot(),
      sessionSnapshot(),
      classSnapshot(),
      enrollmentSnapshot(),
      laboratorySnapshot(),
      attendanceSnapshot(false),
    ]);

    await expect(makeService().checkIn('s5', user, {
      latitude: -7.05,
      longitude: 110.44,
      accuracyMeters: 20,
    })).resolves.toMatchObject({
      ok: true,
      distanceMeters: 0,
      radiusMeters: 500,
    });

    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendances/s5_u1' }),
      expect.objectContaining({
        sessionId: 's5',
        praktikanId: 'u1',
        attendanceMethod: 'location',
        distanceMeters: 0,
        laboratoryId: 'lab-1',
        attendedAt: 'server_timestamp_sentinel',
      }),
    );
  });

  it('rejects legacy string session times before the attendance write', async () => {
    const transaction = useTransaction([
      profileSnapshot(),
      sessionSnapshot('dibuka', {
        startsAt: '2026-11-15T10:00:00+07:00',
        endsAt: '2026-11-15T12:00:00+07:00',
      }),
    ]);

    await expect(makeService().checkIn('s5', user, {
      latitude: -7.05,
      longitude: 110.44,
      accuracyMeters: 20,
    })).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining('Timestamp'),
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects invalid GPS accuracy before reading Firestore', async () => {
    await expect(makeService().checkIn('s5', user, {
      latitude: -7.05,
      longitude: 110.44,
      accuracyMeters: 51,
    })).resolves.toMatchObject({ ok: false, reason: expect.stringContaining('50 meter') });
    expect(mockedRunTransaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate attendance and does not write a second record', async () => {
    const transaction = useTransaction([
      profileSnapshot(),
      sessionSnapshot(),
      classSnapshot(),
      enrollmentSnapshot(),
      laboratorySnapshot(),
      attendanceSnapshot(true),
    ]);

    await expect(makeService().checkIn('s5', user, {
      latitude: -7.05,
      longitude: 110.44,
      accuracyMeters: 20,
    })).resolves.toMatchObject({ ok: false, reason: 'Kamu sudah melakukan presensi pada sesi ini.' });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects a check-in when the session is closed or enrollment is missing', async () => {
    useTransaction([profileSnapshot(), sessionSnapshot('ditutup')]);
    await expect(makeService().checkIn('s5', user, {
      latitude: -7.05,
      longitude: 110.44,
      accuracyMeters: 20,
    })).resolves.toMatchObject({ ok: false, reason: 'Presensi hanya tersedia saat sesi dibuka.' });

    const transaction = useTransaction([
      profileSnapshot(),
      sessionSnapshot(),
      classSnapshot(),
      enrollmentSnapshot(null),
    ]);
    await expect(makeService().checkIn('s5', user, {
      latitude: -7.05,
      longitude: 110.44,
      accuracyMeters: 20,
    })).resolves.toMatchObject({ ok: false, reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('cancels a present attendance only for the owning assistant', async () => {
    const transaction = useTransaction([
      profileSnapshot('asisten'),
      sessionSnapshot(),
      snapshot({ sessionId: 's5', status: 'hadir' }, 's5_u1'),
    ]);

    await expect(makeService(assistant).cancelAttendance('s5', 's5_u1', 'duplikat'))
      .resolves.toEqual({ ok: true });
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendances/s5_u1' }),
      expect.objectContaining({
        status: 'dibatalkan',
        cancelledBy: 'asst-1',
        cancelReason: 'duplikat',
      }),
    );
  });

  it('scopes a praktikan session attendance listener to that praktikan', () => {
    const service = makeService();
    service.subscribeToAttendance('s5', jest.fn(), undefined, 'u1');

    expect(mockedWhere).toHaveBeenNthCalledWith(1, 'sessionId', '==', 's5');
    expect(mockedWhere).toHaveBeenNthCalledWith(2, 'praktikanId', '==', 'u1');
  });

  it('streams attendance snapshots through onSnapshot', () => {
    const service = makeService();
    const onData = jest.fn<void, [AttendanceRecord[]]>();
    let emit: ((snapshot: unknown) => void) | undefined;

    mockedOnSnapshot.mockImplementationOnce((_reference, next) => {
      emit = next as (snapshot: unknown) => void;
      return jest.fn();
    });

    service.subscribeToAttendance('s5', onData);
    emit?.({
      docs: [
        {
          id: 's5_u1',
          data: (): DocumentData => ({
            sessionId: 's5',
            praktikanId: 'u1',
            praktikanName: 'User Satu',
            attendedAt: '2026-11-15T10:15:00+07:00',
            status: 'hadir',
          }),
        },
      ],
    });

    expect(mockedWhere).toHaveBeenCalledWith('sessionId', '==', 's5');
    expect(onData).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's5_u1', praktikanName: 'User Satu', status: 'hadir' }),
    ]);
  });

  it('returns the onSnapshot unsubscribe function', () => {
    const service = makeService();
    const unsubscribe = jest.fn();
    mockedOnSnapshot.mockReturnValueOnce(unsubscribe);

    const stop = service.subscribeToAttendance('s5', jest.fn());

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('subscribes to the whole attendances collection without a where filter', () => {
    const service = makeService();
    const onData = jest.fn<void, [AttendanceRecord[]]>();
    let emit: ((snapshot: unknown) => void) | undefined;

    mockedOnSnapshot.mockImplementationOnce((_reference, next) => {
      emit = next as (snapshot: unknown) => void;
      return jest.fn();
    });

    service.subscribeToAllAttendance(onData);

    expect(mockedCollection).toHaveBeenCalledWith(expect.anything(), 'attendances');
    expect(mockedWhere).not.toHaveBeenCalled();

    emit?.({
      docs: [
        {
          id: 's6_u2',
          data: (): DocumentData => ({
            sessionId: 's6',
            praktikanId: 'u2',
            praktikanName: 'User Dua',
            attendedAt: '2026-11-15T11:00:00+07:00',
            status: 'hadir',
          }),
        },
        {
          id: 's5_u1',
          data: (): DocumentData => ({
            sessionId: 's5',
            praktikanId: 'u1',
            praktikanName: 'User Satu',
            attendedAt: '2026-11-15T10:15:00+07:00',
            status: 'hadir',
          }),
        },
      ],
    });

    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData.mock.calls[0][0].map((record) => record.id)).toEqual(['s5_u1', 's6_u2']);
  });

  it('returns the all-attendance unsubscribe function', () => {
    const service = makeService();
    const unsubscribe = jest.fn();
    mockedOnSnapshot.mockReturnValueOnce(unsubscribe);

    const stop = service.subscribeToAllAttendance(jest.fn());

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('forwards all-attendance listener errors to the screen', () => {
    const service = makeService();
    const onError = jest.fn();
    let emitError: ((error: unknown) => void) | undefined;

    mockedOnSnapshot.mockImplementationOnce((_reference, _next, error) => {
      emitError = error as (error: unknown) => void;
      return jest.fn();
    });

    service.subscribeToAllAttendance(jest.fn(), onError);
    emitError?.({ code: 'permission-denied' });

    expect(onError).toHaveBeenCalledWith(
      'Akses ditolak. Periksa Firestore Security Rules untuk koleksi attendances.',
    );
  });

  it('forwards listener errors to the screen', () => {
    const service = makeService();
    const onError = jest.fn();
    let emitError: ((error: unknown) => void) | undefined;

    mockedOnSnapshot.mockImplementationOnce((_reference, _next, error) => {
      emitError = error as (error: unknown) => void;
      return jest.fn();
    });

    service.subscribeToSessions(jest.fn(), onError);
    emitError?.(new Error('network down'));

    expect(onError).toHaveBeenCalledWith(
      'Gagal memuat data presensi. Periksa koneksi dan konfigurasi Firebase.',
    );
  });
});

describe('Spark QR workflow', () => {
  const token = 'x'.repeat(43);
  const payload = `TANDAIU-ATTENDANCE:1:${token}`;
  const validQr = {
    sessionId: 's5',
    token,
    issuedBy: 'asst-1',
    issuedAt: Timestamp.fromDate(fixedNow),
    expiresAt: Timestamp.fromDate(new Date(fixedNow.getTime() + 60_000)),
    revokedAt: null,
    revokedBy: null,
  };

  it('issues a QR document with the existing payload prefix and two-minute expiry', async () => {
    const transaction = useTransaction([
      profileSnapshot('asisten'),
      sessionSnapshot(),
    ]);

    const result = await makeService(assistant).issueAttendanceQr('s5');
    expect(result).toMatchObject({
      ok: true,
      qrPayload: expect.stringMatching(/^TANDAIU-ATTENDANCE:1:[A-Za-z0-9_-]{43}$/),
    });
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendanceQrTokens/s5' }),
      expect.objectContaining({
        sessionId: 's5',
        issuedBy: 'asst-1',
        revokedAt: null,
        revokedBy: null,
      }),
    );
  });

  it('validates a QR against the active session, enrollment, and token record', async () => {
    useTransaction([
      profileSnapshot(),
      sessionSnapshot(),
      enrollmentSnapshot(),
      qrSnapshot(validQr),
    ]);

    await expect(makeService().validateAttendanceQr('s5', payload)).resolves.toMatchObject({
      ok: true,
      practicumName: 'Praktikum Satu',
      className: 'A1',
      expiresAt: new Date(fixedNow.getTime() + 60_000).toISOString(),
    });
  });

  it('submits QR attendance and stores the token with the attendance record', async () => {
    const transaction = useTransaction([
      profileSnapshot(),
      sessionSnapshot(),
      classSnapshot(),
      enrollmentSnapshot(),
      laboratorySnapshot(),
      attendanceSnapshot(false),
      qrSnapshot(validQr),
    ]);

    await expect(makeService().submitQrAttendance('s5', payload, {
      latitude: -7.05,
      longitude: 110.44,
      accuracyMeters: 20,
    })).resolves.toMatchObject({ ok: true, distanceMeters: 0, radiusMeters: 500 });
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendances/s5_u1' }),
      expect.objectContaining({ attendanceMethod: 'qr', qrToken: token }),
    );
  });

  it('revokes a QR through a Firestore transaction', async () => {
    const transaction = useTransaction([
      profileSnapshot('asisten'),
      sessionSnapshot(),
      qrSnapshot(validQr),
    ]);

    await expect(makeService(assistant).revokeAttendanceQr('s5')).resolves.toEqual({ ok: true });
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendanceQrTokens/s5' }),
      expect.objectContaining({ revokedBy: 'asst-1' }),
    );
  });
});
