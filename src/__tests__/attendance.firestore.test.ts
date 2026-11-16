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
  where: jest.fn(),
}));

const user: CurrentUser = {
  uid: 'u1',
  name: 'User Satu',
  email: 'user.satu@students.undip.ac.id',
  role: 'praktikan',
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

function sessionSnapshot(status: string | null) {
  return {
    id: 's5',
    exists: () => status !== null,
    data: () => ({ status }),
  };
}

function attendanceSnapshot(exists: boolean) {
  return {
    id: 's5_u1',
    exists: () => exists,
    data: () => ({}),
  };
}

function makeTransaction(results: (ReturnType<typeof sessionSnapshot> | ReturnType<typeof attendanceSnapshot>)[]) {
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
      { status: 'dibuka' },
    );
  });

  it('closes a dibuka session with a transaction (SRS-08)', async () => {
    const service = makeService();
    const transaction = useTransaction(makeTransaction([sessionSnapshot('dibuka')]));

    await expect(service.closeSession('s5')).resolves.toEqual({ ok: true });

    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/s5' }),
      { status: 'ditutup' },
    );
  });

  it('creates attendances/{sessionId}_{uid} for a check-in (SRS-09)', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([sessionSnapshot('dibuka'), attendanceSnapshot(false)]),
    );

    await expect(service.checkIn('s5', user)).resolves.toEqual({ ok: true });

    expect(transaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'attendances/s5_u1' }),
      {
        sessionId: 's5',
        praktikanId: 'u1',
        praktikanName: 'User Satu',
        attendedAt: fixedNow.toISOString(),
        status: 'hadir',
      },
    );
  });

  it('rejects a duplicate check-in atomically (SRS-11)', async () => {
    const service = makeService();
    const transaction = useTransaction(
      makeTransaction([sessionSnapshot('dibuka'), attendanceSnapshot(true)]),
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

  it('maps Firestore permission errors to a readable reason', async () => {
    const service = makeService();
    mockedRunTransaction.mockRejectedValueOnce({ code: 'permission-denied' });

    await expect(service.openSession('s5')).resolves.toEqual({
      ok: false,
      reason: 'Akses ditolak. Periksa Firestore Security Rules untuk koleksi attendances.',
    });
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
