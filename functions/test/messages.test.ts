import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPermitResultMessage,
  buildScheduleChangedMessage,
  buildSessionOpenedMessage,
  resolvePracticumName,
} from '../src/messages';

test('nama praktikum jatuh ke courseId bila nama tidak tersedia', () => {
  assert.equal(resolvePracticumName({ practicumName: 'Struktur Data', courseId: 'struktur-data' }), 'Struktur Data');
  assert.equal(resolvePracticumName({ practicumName: '  ', courseId: 'struktur-data' }), 'struktur-data');
  assert.equal(resolvePracticumName({ courseId: '  ' }), 'Praktikum');
});

test('pesan sesi dibuka memuat nama praktikum dan kelas', () => {
  assert.deepEqual(
    buildSessionOpenedMessage({ practicumName: 'Dasar Pemrograman', className: 'A' }),
    { title: 'Sesi dibuka', body: 'Dasar Pemrograman (A) sudah dibuka.' },
  );
  assert.deepEqual(
    buildSessionOpenedMessage({ courseId: 'basis-data' }),
    { title: 'Sesi dibuka', body: 'basis-data sudah dibuka.' },
  );
});

test('pesan jadwal berubah memuat ringkasan perubahan', () => {
  assert.deepEqual(
    buildScheduleChangedMessage({
      courseId: 'basis-data',
      className: 'B',
      changes: ['Hari berubah', 'Ruangan berubah menjadi Lab A'],
    }),
    {
      title: 'Jadwal berubah',
      body: 'basis-data (B): Hari berubah, Ruangan berubah menjadi Lab A.',
    },
  );
  assert.deepEqual(
    buildScheduleChangedMessage({ practicumName: 'Struktur Data', changes: ['  '] }),
    { title: 'Jadwal berubah', body: 'Struktur Data: jadwal diperbarui.' },
  );
});

test('pesan hasil izin memuat status Disetujui atau Ditolak', () => {
  assert.deepEqual(
    buildPermitResultMessage({
      status: 'approved',
      practicumName: 'Struktur Data',
      className: 'C',
    }),
    {
      title: 'Hasil pengajuan izin',
      body: 'Pengajuan izinmu Disetujui untuk Struktur Data (C).',
    },
  );
  assert.deepEqual(
    buildPermitResultMessage({ status: 'rejected', courseId: 'jaringan-komputer' }),
    {
      title: 'Hasil pengajuan izin',
      body: 'Pengajuan izinmu Ditolak untuk jaringan-komputer.',
    },
  );
});
