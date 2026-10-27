import { PracticumCourse } from '../types';

/**
 * Master data mata kuliah praktikum dari daftar resmi yang diberikan PM.
 * Data ini hanya untuk demo dan tidak memuat kode mata kuliah resmi.
 */
export const courses: PracticumCourse[] = [
  { id: 'dasar-pemrograman', name: 'Dasar Pemrograman', semester: 1 },
  { id: 'dasar-sistem', name: 'Dasar Sistem', semester: 1 },

  { id: 'algoritma-dan-pemrograman', name: 'Algoritma dan Pemrograman', semester: 2 },

  { id: 'sistem-operasi', name: 'Sistem Operasi', semester: 3 },
  { id: 'struktur-data', name: 'Struktur Data', semester: 3 },
  { id: 'basis-data', name: 'Basis Data', semester: 3 },

  { id: 'manajemen-basis-data', name: 'Manajemen Basis Data', semester: 4 },
  {
    id: 'pemrograman-berorientasi-objek',
    name: 'Pemrograman Berorientasi Objek',
    semester: 4,
  },
  {
    id: 'grafik-dan-teknik-interaktif',
    name: 'Grafik dan Teknik Interaktif',
    semester: 4,
  },
  {
    id: 'analisis-dan-strategi-algoritma',
    name: 'Analisis dan Strategi Algoritma',
    semester: 4,
  },
  { id: 'jaringan-komputer', name: 'Jaringan Komputer', semester: 4 },

  { id: 'pengembangan-platform-khusus', name: 'Pengembangan Platform Khusus', semester: 5 },
  { id: 'pembelajaran-mesin', name: 'Pembelajaran Mesin', semester: 5 },
];
