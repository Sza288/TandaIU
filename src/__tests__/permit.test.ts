import { analyzePermitSentiment } from '../features/permit/sentiment';
import { Permit } from '../features/permit/permit.types';
import {
  __resetPermitsForTests,
  getPermits,
  reviewPermit,
  submitPermit,
  subscribePermits,
} from '../services/permitService';

const seedPermit: Permit = {
  id: 'perm-test',
  sessionId: 's5',
  studentId: 'p1',
  studentName: 'Andi Pratama',
  reason: 'Demam tinggi, harus istirahat.',
  sentiment: 'negatif',
  sentimentSource: 'model',
  status: 'pending',
  createdAt: '2026-10-27T06:30:00+07:00',
};

describe('analyzePermitSentiment', () => {
  it('memakai model on-device untuk teks yang dikenali', async () => {
    await expect(analyzePermitSentiment('Penjelasan asisten jelas dan bagus')).resolves.toEqual({
      sentiment: 'positif',
      source: 'model',
    });
    await expect(analyzePermitSentiment('Demam tinggi, harus istirahat.')).resolves.toEqual({
      sentiment: 'negatif',
      source: 'model',
    });
  });

  it('jatuh ke analisis cadangan saat model tidak mengenali kosakata', async () => {
    const result = await analyzePermitSentiment('zxqv wplk');
    expect(result.source).toBe('fallback');
    expect(['positif', 'netral', 'negatif']).toContain(result.sentiment);
  });

  it('mengembalikan netral untuk alasan kosong', async () => {
    await expect(analyzePermitSentiment('   ')).resolves.toEqual({
      sentiment: 'netral',
      source: 'fallback',
    });
  });
});

describe('permitService', () => {
  beforeEach(() => {
    __resetPermitsForTests([]);
  });

  it('menyimpan pengajuan izin beserta sentimen dan memberi notifikasi', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribePermits(listener);

    const result = await submitPermit({
      sessionId: 's5',
      studentId: 'p1',
      studentName: 'Andi Pratama',
      reason: 'Penjelasan asisten jelas dan bagus',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.permit.status).toBe('pending');
    expect(result.permit.sentiment).toBe('positif');
    expect(result.permit.sentimentSource).toBe('model');
    expect(getPermits()).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('menolak pengajuan tanpa sesi, identitas, atau alasan yang cukup', async () => {
    const noSession = await submitPermit({
      sessionId: '',
      studentId: 'p1',
      studentName: 'Andi Pratama',
      reason: 'Alasan yang cukup panjang.',
    });
    expect(noSession.ok).toBe(false);

    const shortReason = await submitPermit({
      sessionId: 's5',
      studentId: 'p1',
      studentName: 'Andi Pratama',
      reason: 'sakit',
    });
    expect(shortReason.ok).toBe(false);
    expect(getPermits()).toHaveLength(0);
  });

  it('menyetujui izin pending dan menolak review ulang', async () => {
    __resetPermitsForTests([seedPermit]);

    const approved = await reviewPermit('perm-test', 'approved', 'Lily Collins');
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.permit.status).toBe('approved');
    expect(approved.permit.reviewedBy).toBe('Lily Collins');
    expect(approved.permit.reviewedAt).toBeTruthy();

    const repeated = await reviewPermit('perm-test', 'rejected');
    expect(repeated.ok).toBe(false);
    expect(getPermits()[0].status).toBe('approved');
  });

  it('menolak review untuk id yang tidak ada', async () => {
    const result = await reviewPermit('perm-tidak-ada', 'rejected');
    expect(result.ok).toBe(false);
  });
});
