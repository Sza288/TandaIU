import { setDoc } from 'firebase/firestore';

import { analyzeReviewSentiment } from '../features/review/sentiment';
import { submitReview } from '../services/reviewService';

const mockAuthState: { currentUser: { uid: string } | null } = {
  currentUser: { uid: 'praktikan-uid' },
};

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ path: 'reviews' })),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `reviews/${id}` })),
  onSnapshot: jest.fn(() => () => undefined),
  query: jest.fn(() => ({})),
  setDoc: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState.currentUser = { uid: 'praktikan-uid' };
  (setDoc as jest.Mock).mockResolvedValue(undefined);
});

describe('analyzeReviewSentiment', () => {
  it('memakai model on-device untuk ulasan yang dikenali', async () => {
    await expect(analyzeReviewSentiment('Penjelasan asisten jelas dan bagus')).resolves.toEqual({
      sentiment: 'positif',
      source: 'model',
    });
    await expect(analyzeReviewSentiment('Sulit dipahami')).resolves.toEqual({
      sentiment: 'negatif',
      source: 'model',
    });
  });

  it('jatuh ke analisis cadangan saat model tidak mengenali kosakata', async () => {
    const result = await analyzeReviewSentiment('zxqv wplk');
    expect(result.source).toBe('fallback');
    expect(['positif', 'netral', 'negatif']).toContain(result.sentiment);
  });

  it('mengembalikan netral saat margin prediksi model terlalu tipis', async () => {
    await expect(analyzeReviewSentiment('tidak menyenangkan')).resolves.toEqual({
      sentiment: 'netral',
      source: 'model',
    });
  });

  it('mendeteksi kata negatif lewat analisis cadangan', async () => {
    await expect(analyzeReviewSentiment('jelek parah')).resolves.toEqual({
      sentiment: 'negatif',
      source: 'fallback',
    });
  });

  it('mengembalikan netral untuk ulasan kosong', async () => {
    await expect(analyzeReviewSentiment('   ')).resolves.toEqual({
      sentiment: 'netral',
      source: 'fallback',
    });
  });
});

describe('submitReview', () => {
  it('menyimpan ulasan dengan ID sesi_uid beserta sentimen', async () => {
    const result = await submitReview({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      comment: 'Penjelasan asisten jelas dan bagus',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.review.id).toBe('s5_praktikan-uid');
    expect(result.review.sentiment).toBe('positif');
    expect(result.review.sentimentSource).toBe('model');

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's5_praktikan-uid' }),
      expect.objectContaining({
        sessionId: 's5',
        studentId: 'praktikan-uid',
        studentName: 'Andi Pratama',
        sentiment: 'positif',
        sentimentSource: 'model',
      }),
    );
  });

  it('menolak ulasan yang terlalu pendek tanpa menulis dokumen', async () => {
    const result = await submitReview({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      comment: 'mantap',
    });

    expect(result.ok).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('menolak ulasan tanpa sesi atau identitas yang tidak cocok', async () => {
    const noSession = await submitReview({
      sessionId: '',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      comment: 'Penjelasan asisten jelas dan bagus',
    });
    expect(noSession.ok).toBe(false);

    mockAuthState.currentUser = { uid: 'uid-lain' };
    const mismatch = await submitReview({
      sessionId: 's5',
      studentId: 'praktikan-uid',
      studentName: 'Andi Pratama',
      comment: 'Penjelasan asisten jelas dan bagus',
    });
    expect(mismatch.ok).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
