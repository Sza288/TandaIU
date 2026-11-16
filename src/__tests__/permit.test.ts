import { runTransaction } from 'firebase/firestore';

import { Permit } from '../features/permit/permit.types';
import { getPermitId, reviewPermit, submitPermit } from '../services/permitService';

const mockAuthState: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'praktikan-uid' },
};

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ path: 'permits' })),
  doc: jest.fn((_db, collectionName, id) => ({ id, path: `${collectionName}/${id}` })),
  onSnapshot: jest.fn(() => () => undefined),
  query: jest.fn(() => ({})),
  runTransaction: jest.fn(),
  where: jest.fn(() => ({})),
}));

jest.mock('../lib/firebase', () => ({
  db: {},
  auth: {
    get currentUser() {
      return mockAuthState.currentUser;
    },
  },
}));

const seedPermit: Permit = {
  id: 'perm-test',
  sessionId: 's5',
  studentId: 'praktikan-uid',
  studentName: 'Andi Pratama',
  reason: 'Demam tinggi, harus istirahat.',
  status: 'pending',
  createdAt: '2026-10-27T06:30:00+07:00',
};

function mockPendingTransaction(current: Permit | null, update = jest.fn()) {
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
    const { id, ...data } = current ?? ({} as Permit);
    const snapshot = {
      id: current?.id ?? 'perm-test',
      exists: () => current !== null,
      data: () => data,
    };
    const transaction = {
      get: jest.fn().mockResolvedValue(snapshot),
      update,
    };
    return callback(transaction);
  });
  return update;
}

function mockSubmitTransaction(existing: Permit | null, set = jest.fn()) {
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
    const snapshot = {
      id: existing?.id ?? 'perm-baru',
      exists: () => existing !== null,
      data: () => {
        if (!existing) return {};
        const { id, ...data } = existing;
        return data;
      },
    };
    const transaction = {
      get: jest.fn().mockResolvedValue(snapshot),
      set,
    };
    return callback(transaction);
  });
  return set;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState.currentUser = { uid: 'praktikan-uid' };
});

describe('submitPermit', () => {
  it('menyimpan pengajuan izin tanpa sentimen memakai ID sesi_uid', async () => {
    const set = mockSubmitTransaction(null);

    const result = await submitPermit({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      reason: 'Demam tinggi, harus istirahat.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getPermitId('s5', 'praktikan-uid')).toBe('s5_praktikan-uid');
    expect(result.permit.id).toBe('s5_praktikan-uid');
    expect(result.permit.status).toBe('pending');
    expect(result.permit.studentId).toBe('praktikan-uid');

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's5_praktikan-uid' }),
      expect.objectContaining({
        sessionId: 's5',
        studentId: 'praktikan-uid',
        studentName: 'Andi Pratama',
        status: 'pending',
      }),
    );
    const payload = set.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('sentiment');
    expect(payload).not.toHaveProperty('sentimentSource');
  });

  it('menolak pengajuan kedua untuk sesi yang sama', async () => {
    const set = mockSubmitTransaction({ ...seedPermit, id: 's5_praktikan-uid' });

    const result = await submitPermit({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      reason: 'Alasan lain untuk sesi yang sama.',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('Kamu sudah mengajukan izin untuk sesi ini.');
    expect(set).not.toHaveBeenCalled();
  });

  it('menolak pengajuan tanpa sesi atau alasan yang cukup', async () => {
    mockSubmitTransaction(null);

    const noSession = await submitPermit({
      sessionId: '',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      reason: 'Alasan yang cukup panjang.',
    });
    expect(noSession.ok).toBe(false);

    const shortReason = await submitPermit({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      reason: 'sakit',
    });
    expect(shortReason.ok).toBe(false);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('menolak pengajuan tanpa sesi login atau identitas yang tidak cocok', async () => {
    mockSubmitTransaction(null);

    mockAuthState.currentUser = null;
    const signedOut = await submitPermit({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      reason: 'Demam tinggi, harus istirahat.',
    });
    expect(signedOut.ok).toBe(false);

    mockAuthState.currentUser = { uid: 'uid-lain' };
    const mismatch = await submitPermit({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      reason: 'Demam tinggi, harus istirahat.',
    });
    expect(mismatch.ok).toBe(false);
    expect(runTransaction).not.toHaveBeenCalled();
  });
});

describe('reviewPermit', () => {
  it('menyetujui izin pending dan mengirim hanya field review', async () => {
    const update = mockPendingTransaction(seedPermit);

    const result = await reviewPermit('perm-test', 'approved', 'Lily Collins');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.permit.status).toBe('approved');
    expect(result.permit.reviewedBy).toBe('Lily Collins');
    expect(result.permit.reviewedAt).toBeTruthy();
    expect(update).toHaveBeenCalledWith(expect.anything(), {
      status: 'approved',
      reviewedAt: expect.any(String),
      reviewedBy: 'Lily Collins',
    });
  });

  it('menolak review ulang untuk izin yang sudah diputuskan', async () => {
    const update = mockPendingTransaction({ ...seedPermit, status: 'approved' });

    const result = await reviewPermit('perm-test', 'rejected');
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('menolak review untuk id yang tidak ada', async () => {
    const update = mockPendingTransaction(null);

    const result = await reviewPermit('perm-tidak-ada', 'rejected');
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
