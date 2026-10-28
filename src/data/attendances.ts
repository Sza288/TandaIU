import { Attendance } from '../types';

/**
 * Presensi demo awal. Setiap pasangan sessionId + praktikanId hanya muncul
 * sekali agar konsisten dengan aturan pencegahan presensi ganda di FR-12.
 */
export const initialAttendances: Attendance[] = [
  { sessionId: 's1', praktikanId: 'p1', attendedAt: '2026-10-20T10:12:00+07:00' },
  { sessionId: 's1', praktikanId: 'p2', attendedAt: '2026-10-20T10:15:00+07:00' },
  { sessionId: 's1', praktikanId: 'p3', attendedAt: '2026-10-20T10:21:00+07:00' },

  { sessionId: 's2', praktikanId: 'p1', attendedAt: '2026-10-21T13:04:00+07:00' },
  { sessionId: 's2', praktikanId: 'p4', attendedAt: '2026-10-21T13:09:00+07:00' },

  { sessionId: 's3', praktikanId: 'p2', attendedAt: '2026-10-22T09:42:00+07:00' },
  { sessionId: 's3', praktikanId: 'p3', attendedAt: '2026-10-22T09:47:00+07:00' },
  { sessionId: 's3', praktikanId: 'p5', attendedAt: '2026-10-22T09:51:00+07:00' },
  { sessionId: 's3', praktikanId: 'p6', attendedAt: '2026-10-22T09:58:00+07:00' },

  { sessionId: 's4', praktikanId: 'p1', attendedAt: '2026-10-26T08:05:00+07:00' },

  { sessionId: 's5', praktikanId: 'p1', attendedAt: '2026-10-27T08:03:00+07:00' },
  { sessionId: 's5', praktikanId: 'p2', attendedAt: '2026-10-27T08:06:00+07:00' },
  { sessionId: 's5', praktikanId: 'p5', attendedAt: '2026-10-27T08:14:00+07:00' },

  { sessionId: 's9', praktikanId: 'p3', attendedAt: '2026-10-29T08:02:00+07:00' },
  { sessionId: 's9', praktikanId: 'p4', attendedAt: '2026-10-29T08:11:00+07:00' },
];
