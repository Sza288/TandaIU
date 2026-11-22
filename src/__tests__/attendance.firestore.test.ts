import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  type DocumentData,
} from 'firebase/firestore';
import type { CurrentUser } from '../lib/currentSession';
import {
  ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
  ATTENDANCE_IDENTITY_INVALID_REASON,
  createAttendanceService,
  type AttendanceRecord,
} from '../services/attendanceService';

const mockGetCurrentUser = jest.fn<CurrentUser, []>();

jest.mock('../lib/firebase', () => ({ db: { name: 'fake-firestore' } }));
jest.mock('../lib/currentSession', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
jest.mock('firebase/firestore', () => ({
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

const validProfile = {
  uid: 'u1',
  name: 'User Satu Profil',
  email: 'user.satu@students.undip.ac.id',
  role: 'praktikan',
  studentCode: '24060124120001',
};

const fixedNow = new Date('2026-11-15T10:15:00+07:00');

const mockedCollection = jest.mocked(collection);
const mockedDoc = jest.mocked(doc);
const mockedOnSnapshot = jest.mocked(onSnapshot);
const mockedQuery = jest.mocked(query);
const mockedRunTransaction = jest.mocked(runTransaction);
const mockedWhere = jest.mocked(where);

function makeService() {
  return createAttendanceService({
    mode: 'firestore',
    database: {} as never,
    getCurrentUser: () => user,
    now: () => fixedNow,
  });
}

function sessionSnapshot(status: string | null, classId = 'class-1') {
  return {
    id: 's5',
    exists: () => status !== null,
    data: () => ({
      status,
      classId,
      startsAt: '2026-11-15T10:00:00+07:00',
      endsAt: '2026-11-15T12:00:00+07:00',
    }),
  };
}

function profileSnapshot(profile: Record<string, unknown> | null) {
  return {
    id: 'u1',
    exists: () => profile !== null,
    data: () => profile,
  };
}

function enrollmentSnapshot(
  enrollment: Record<string, unknown> | null = {
    praktikanId: 'u1',
    classId: 'class-1',
  },
) {
  return {
    id: 'class-1_u1',
    exists: () => enrollment !== null,
    data: () => enrollment,
  };
}

function attendanceSnapshot(exists: boolean) {
  return {
    id: 's5_u1',
    exists: () => exists,
    data: () => ({}),
  };
}

function makeTransaction(
  results: (
    | ReturnType<typeof sessionSnapshot>
    | ReturnType<typeof enrollmentSnapshot>
    | ReturnType<typeof profileSnapshot>
    | ReturnType<typeof attendanceSnapshot>
  )[],
) {
  const get = jest.fn();
  results.forEach((result) => get.mockResolvedValueOnce(result));
  return {
    get,
    update: jest.fn(),
    set: jest.fn(),
  };
}

function useTransaction(transaction: ReturnType<typeof makeTransaction>) {
  mockedRunTransaction.mockImplementationOnce(async (_database, updateFunction) =>
    updateFunction(transaction as never),
  );
  return transaction;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUser.mockReturnValue(user);
  mockedCollection.mockImplementation((_database, path) => ({ path } as never));
  mockedDoc.mockImplementation(
    (_database, collectionPath, id) => ({ path: `${collectionPath}/${id}`, id } as never),
  );
  mockedQuery.mockImplementation((...args) => args as never);
  mockedWhere.mockImplementation(
    (field, operator, value) => ({ field, operator, value } as never),
  );
  mockedOnSnapshot.mockReturnValue(jest.fn());
});

describe('attendanceService (Firestore mode)', () => {
  it('opens a terjadwal session with a transaction (SRS-08)', async () => {
    const service = makeService();
    const result = sessionSnapshot('terjadwal');
    const transaction = useTransaction(makeTransaction([result]));

    await expect(service.openSession('s5')).resolves.toEqual({ ok: true });

    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/s5' }),
      {
        status: 'dibuka',
        startsAt: new Date('2026-11-15T03:00:00.000Z'),
        endsAt: new Date('2026-11-15T05:00:00.000Z'),
      },
    );
  });

  it('closes a dibuka session with a transaction (SRS-08)', async () => {
    const service = makeService();
    const transaction = useTransaction(makeTransaction([sessionSnapshot('dibuka')]));

    await expect(service.closeSession('s5')).resolves.toEqual({ ok: true });

    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/s5' }),
      {
        status: 'ditutup',
        startsAt: new Date('2026-11-15T03:00:00.000Z'),
        endsAt: new Date('2026-11-15T05:00:00.000Z'),
      },
    );
  });

  it('creates attendances/{sessionId}_{uid} for a check-in (SRS-09)', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([
        sessionSnapshot('dibuka'),
        enrollmentSnapshot(),
        profileSnapshot(validProfile),
        attendanceSnapshot(false),
      ]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({ ok: true });

    expect(mockedDoc).toHaveBeenCalledWith(
      expect.anything(),
      'users',
      'u1',
    );
    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendances/s5_u1' }),
      {
        sessionId: 's5',
        praktikanId: 'u1',
        praktikanName: 'User Satu Profil',
        attendedAt: 'server_timestamp_sentinel',
        status: 'hadir',
      },
    );
  });

  it('rejects a duplicate check-in atomically (SRS-11)', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([
        sessionSnapshot('dibuka'),
        enrollmentSnapshot(),
        profileSnapshot(validProfile),
        attendanceSnapshot(true),
      ]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: 'Kamu sudah melakukan presensi pada sesi ini.',
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects check-in when the session is not dibuka', async () => {
    const service = makeService();
    const transaction = useTransaction(makeTransaction([sessionSnapshot('ditutup')]));

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: 'Presensi hanya tersedia saat sesi dibuka.',
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects check-in when the session has no enrollment class', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([sessionSnapshot('dibuka', '')]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects check-in when the enrollment document is missing', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([
        sessionSnapshot('dibuka'),
        enrollmentSnapshot(null),
      ]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects check-in when the enrollment class does not match the session', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([
        sessionSnapshot('dibuka'),
        enrollmentSnapshot({ praktikanId: 'u1', classId: 'class-2' }),
      ]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON,
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects check-in when the users/{uid} profile is missing', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([
        sessionSnapshot('dibuka'),
        enrollmentSnapshot(),
        profileSnapshot(null),
      ]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects check-in when the profile role is not praktikan', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([
        sessionSnapshot('dibuka'),
        enrollmentSnapshot(),
        profileSnapshot({ ...validProfile, role: 'asisten' }),
      ]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it('rejects a dummy p1..p31 identity in Firestore mode', async () => {
    const service = makeService();
    const dummy: CurrentUser = { ...user, uid: 'p1' };

    await expect(service.checkIn('s5', dummy)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
    expect(mockedRunTransaction).not.toHaveBeenCalled();
  });

  it('rejects check-in when there is no authenticated identity', async () => {
    const service = createAttendanceService({
      mode: 'firestore',
      database: {} as never,
      getCurrentUser: () => null,
      now: () => fixedNow,
    });

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: ATTENDANCE_IDENTITY_INVALID_REASON,
    });
    expect(mockedRunTransaction).not.toHaveBeenCalled();
  });

  it('maps Firestore permission errors on openSession to the sessions collection', async () => {
    const service = makeService();
    mockedRunTransaction.mockRejectedValueOnce({ code: 'permission-denied' });

    const result = await service.openSession('s5');

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('sessions');
    expect(result.reason).not.toContain('attendances');
  });

  it('maps Firestore permission errors on closeSession to the sessions collection', async () => {
    const service = makeService();
    mockedRunTransaction.mockRejectedValueOnce({ code: 'permission-denied' });

    const result = await service.closeSession('s5');

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('sessions');
    expect(result.reason).not.toContain('attendances');
  });

  it('explains that a Rules rejection may be caused by time, status, or enrollment', async () => {
    const service = makeService();
    mockedRunTransaction.mockRejectedValueOnce({ code: 'permission-denied' });

    await expect(service.checkIn('s5', user)).resolves.toEqual({
      ok: false,
      reason: 'Presensi ditolak. Pastikan sesi sedang dibuka, waktu sesi masih berlaku, dan enrollment kamu valid.',
    });
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
