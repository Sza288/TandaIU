import { courses } from '../data/courses';
import { dosen } from '../data/dosen';
import type { MigrationStepResult } from './types';

export type CoursesDosenInventory = {
  courses: number;
  dosen: number;
};

export function getCoursesDosenInventory(): CoursesDosenInventory {
  return {
    courses: courses.length,
    dosen: dosen.length,
  };
}

/**
 * courses dan dosen tidak dimigrasikan ke Firestore karena implementasi saat
 * ini memakai master data lokal dan belum ada consumer collection tersebut.
 * classes/sessions hanya menyimpan courseId dan lecturerId/lecturer sebagai
 * referensi string yang divalidasi terhadap data lokal.
 */
export function getCoursesDosenStep(): MigrationStepResult {
  const inventory = getCoursesDosenInventory();

  return {
    id: 'courses-dosen',
    title: 'Courses dan dosen',
    status: 'skipped',
    summary:
      'Tidak dimigrasikan: aplikasi memakai master data lokal dan tidak ada collection/konsumen courses atau dosen.',
    details: [
      `${inventory.courses} mata kuliah lokal dipakai untuk label, semester, dan validasi classes.courseId.`,
      `${inventory.dosen} dosen lokal dipakai untuk lecturerId/lecturer pada sesi baru.`,
      'classes dan sessions menyimpan referensi string, bukan dokumen courses/dosen.',
      'firestore.rules tidak memiliki match courses/dosen (default deny) dan belum ada hook/service yang membacanya.',
      'Tidak ada penulisan courses/dosen; master data tetap di src/data/courses.ts dan src/data/dosen.ts.',
    ],
  };
}
