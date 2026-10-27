import { PracticumSession } from '../types';

/**
 * Data demo lokal. Waktu memakai offset +07:00 agar konsisten dengan zona
 * waktu yang ditampilkan aplikasi (WIB). Bukan data akademik sungguhan.
 */
export const initialSessions: PracticumSession[] = [
  {
    id: 's1',
    practicumName: 'Pemrograman Berbasis Objek',
    className: 'A1',
    startsAt: '2026-10-20T10:10:00+07:00',
    endsAt: '2026-10-20T12:10:00+07:00',
    status: 'ditutup',
  },
  {
    id: 's2',
    practicumName: 'Basis Data',
    className: 'B1',
    startsAt: '2026-10-21T13:00:00+07:00',
    endsAt: '2026-10-21T15:10:00+07:00',
    status: 'ditutup',
  },
  {
    id: 's3',
    practicumName: 'Jaringan Komputer',
    className: 'D2',
    startsAt: '2026-10-22T09:40:00+07:00',
    endsAt: '2026-10-22T11:40:00+07:00',
    status: 'ditutup',
  },
  {
    id: 's4',
    practicumName: 'Sistem Operasi',
    className: 'A2',
    startsAt: '2026-10-26T08:00:00+07:00',
    endsAt: '2026-10-26T10:00:00+07:00',
    status: 'ditutup',
  },
  {
    id: 's5',
    practicumName: 'Struktur Data',
    className: 'C1',
    startsAt: '2026-10-27T08:00:00+07:00',
    endsAt: '2026-10-27T10:00:00+07:00',
    status: 'dibuka',
  },
  {
    id: 's6',
    practicumName: 'Pemrograman Web',
    className: 'B2',
    startsAt: '2026-10-27T13:00:00+07:00',
    endsAt: '2026-10-27T15:10:00+07:00',
    status: 'terjadwal',
  },
  {
    id: 's7',
    practicumName: 'Algoritma dan Pemrograman',
    className: 'C2',
    startsAt: '2026-10-28T08:00:00+07:00',
    endsAt: '2026-10-28T10:00:00+07:00',
    status: 'terjadwal',
  },
  {
    id: 's8',
    practicumName: 'Rekayasa Perangkat Lunak',
    className: 'A3',
    startsAt: '2026-10-28T13:00:00+07:00',
    endsAt: '2026-10-28T15:10:00+07:00',
    status: 'terjadwal',
  },
  {
    id: 's9',
    practicumName: 'Kecerdasan Buatan',
    className: 'D1',
    startsAt: '2026-10-29T08:00:00+07:00',
    endsAt: '2026-10-29T10:00:00+07:00',
    status: 'dibuka',
  },
  {
    id: 's10',
    practicumName: 'Grafika Komputer',
    className: 'B3',
    startsAt: '2026-10-29T13:00:00+07:00',
    endsAt: '2026-10-29T15:10:00+07:00',
    status: 'terjadwal',
  },
  {
    id: 's11',
    practicumName: 'Keamanan Informasi',
    className: 'C3',
    startsAt: '2026-10-30T08:00:00+07:00',
    endsAt: '2026-10-30T10:00:00+07:00',
    status: 'terjadwal',
  },
  {
    id: 's12',
    practicumName: 'Interaksi Manusia Komputer',
    className: 'A4',
    startsAt: '2026-10-30T13:00:00+07:00',
    endsAt: '2026-10-30T15:10:00+07:00',
    status: 'terjadwal',
  },
];
