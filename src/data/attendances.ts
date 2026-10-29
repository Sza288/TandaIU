import { Attendance } from '../types';

/** Data presensi demo dibedakan per sesi dan hanya memakai mahasiswa di semester sesi. */
export const initialAttendances: Attendance[] = [
  { sessionId: 's1', praktikanId: 'p6', attendedAt: '2026-10-20T10:12:00+07:00' },
  { sessionId: 's1', praktikanId: 'p30', attendedAt: '2026-10-20T10:18:00+07:00' },

  { sessionId: 's2', praktikanId: 'p1', attendedAt: '2026-10-21T13:04:00+07:00' },
  { sessionId: 's2', praktikanId: 'p8', attendedAt: '2026-10-21T13:09:00+07:00' },
  { sessionId: 's2', praktikanId: 'p14', attendedAt: '2026-10-21T13:15:00+07:00' },
  {
    sessionId: 's2',
    praktikanId: 'p20',
    attendedAt: '2026-10-21T13:20:00+07:00',
    status: 'izin',
    excuseReason: 'sakit',
  },

  { sessionId: 's3', praktikanId: 'p30', attendedAt: '2026-10-22T09:42:00+07:00' },
  {
    sessionId: 's3',
    praktikanId: 'p31',
    attendedAt: '2026-10-22T09:47:00+07:00',
    status: 'izin',
    excuseReason: 'izin-lainnya',
  },

  { sessionId: 's4', praktikanId: 'p5', attendedAt: '2026-10-26T08:05:00+07:00' },
  { sessionId: 's4', praktikanId: 'p11', attendedAt: '2026-10-26T08:12:00+07:00' },
  { sessionId: 's4', praktikanId: 'p23', attendedAt: '2026-10-26T08:19:00+07:00' },

  { sessionId: 's5', praktikanId: 'p1', attendedAt: '2026-10-27T08:09:00+07:00', status: 'hadir' },
  { sessionId: 's5', praktikanId: 'p8', attendedAt: '2026-10-27T08:16:00+07:00', status: 'hadir' },
  {
    sessionId: 's5',
    praktikanId: 'p5',
    attendedAt: '2026-10-27T08:21:00+07:00',
    status: 'izin',
    excuseReason: 'sakit',
  },
  {
    sessionId: 's5',
    praktikanId: 'p11',
    attendedAt: '2026-10-27T08:25:00+07:00',
    status: 'izin',
    excuseReason: 'izin-lainnya',
  },
];
