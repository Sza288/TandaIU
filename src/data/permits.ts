import { Permit } from '../features/permit/permit.types';

/**
 * Data demo lokal untuk fitur pengajuan izin. Nilai waktu memakai offset
 * +07:00 agar konsisten dengan zona waktu aplikasi (WIB).
 */
export const dummyPermits: Permit[] = [
  {
    id: 'perm-01',
    sessionId: 's5',
    studentId: 'p1',
    studentName: 'Andi Pratama',
    reason: 'Demam tinggi, harus istirahat.',
    status: 'pending',
    createdAt: '2026-10-27T06:30:00+07:00',
  },
];
