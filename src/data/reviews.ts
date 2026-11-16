import { Review } from '../features/review/review.types';

/**
 * Data demo lokal untuk fitur ulasan pasca-praktikum. ID dokumen mengikuti
 * pola `{sessionId}_{studentId}` agar satu praktikan hanya punya satu ulasan
 * per sesi.
 */
export const dummyReviews: Review[] = [
  {
    id: 's5_p1',
    sessionId: 's5',
    studentId: 'p1',
    studentName: 'Andi Pratama',
    comment: 'Materi jelas, asisten sabar, dan praktikum menyenangkan.',
    sentiment: 'positif',
    sentimentSource: 'model',
    createdAt: '2026-10-27T10:05:00+07:00',
  },
];
