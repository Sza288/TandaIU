import { initialAttendances } from '../data/attendances';
import { courses } from '../data/courses';
import { dosen } from '../data/dosen';
import { dummyPermits } from '../data/permits';
import { praktikans } from '../data/praktikans';
import { dummyReviews } from '../data/reviews';
import { initialSessions } from '../data/sessions';
import type { MigrationStepResult } from './types';

export type LocalDummyInventory = {
  praktikans: number;
  sessions: number;
  attendances: number;
  permits: number;
  reviews: number;
  courses: number;
  dosen: number;
};

export function getLocalDummyInventory(): LocalDummyInventory {
  return {
    praktikans: praktikans.length,
    sessions: initialSessions.length,
    attendances: initialAttendances.length,
    permits: dummyPermits.length,
    reviews: dummyReviews.length,
    courses: courses.length,
    dosen: dosen.length,
  };
}

/**
 * Data dummy selain classes/sessions/enrollments tidak ditulis karena batas
 * kepemilikan data di Security Rules, bukan karena diabaikan.
 */
export function getOtherDummyDataSteps(): MigrationStepResult[] {
  const inventory = getLocalDummyInventory();

  return [
    {
      id: 'schedules',
      title: 'Schedules',
      status: 'skipped',
      summary:
        'Tidak ada dummy schedule lokal yang dapat dimigrasikan tanpa mengarang hari, jam, dan ruangan.',
      details: [
        'initialSessions tidak menyimpan dayOfWeek, startTime, endTime, atau room yang dibutuhkan ScheduleDoc.',
        'Tidak ada file src/data/schedules.ts.',
        'Collection schedules yang sudah ada dipertahankan tanpa perubahan.',
      ],
    },
    {
      id: 'permits-reviews',
      title: 'Permits dan reviews',
      status: 'blocked',
      summary:
        'Dummy permits/reviews tidak dapat ditulis karena rules mewajibkan kepemilikan studentId dan ID {sessionId}_{uid}.',
      details: [
        `${inventory.permits} dummy permit dan ${inventory.reviews} dummy review memakai studentId 'p1', bukan Firebase Auth UID.`,
        'Rules permits/reviews mensyaratkan studentId == request.auth.uid dan ID dokumen {sessionId}_{uid}.',
        'Operator asisten tidak boleh membuat dokumen atas nama praktikan; pembuatan harus dilakukan akun praktikan pemilik UID.',
        'Data permits/reviews yang sudah ada di Firestore tidak ditimpa atau dihapus.',
      ],
    },
    {
      id: 'users-attendance',
      title: 'Users dan attendance',
      status: 'blocked',
      summary:
        'Tidak ada UID Auth palsu; attendance hanya boleh dibuat praktikan untuk dirinya saat sesi dibuka.',
      details: [
        `${inventory.praktikans} praktikan lokal belum memiliki mapping UID Firebase Auth.`,
        `${inventory.attendances} attendance lokal memakai ID p1..p31 dan sebagian berstatus izin.`,
        'Rules attendances mensyaratkan praktikanId == request.auth.uid, status hadir, ID {sessionId}_{uid}, dan sesi berstatus dibuka.',
        'Sesi s1-s4 pada data dummy berstatus ditutup dan tidak dapat dibuka kembali.',
        'Tidak ada akun Auth yang dibuat dan tidak ada attendance yang ditulis.',
      ],
    },
    {
      id: 'users',
      title: 'Users',
      status: 'skipped',
      summary:
        'Dokumen users dimiliki alur registrasi Auth; migrasi tidak membuat atau mengubah profil.',
      details: [
        'users/{uid} dibuat oleh authService saat registrasi email/Google.',
        'Rules users melarang list dan update/delete, sehingga migrasi tidak dapat memverifikasi seluruh UID praktikan.',
        'UID praktikan untuk enrollment harus berasal dari Firebase Console Authentication, bukan dibuat oleh migrasi.',
      ],
    },
  ];
}
