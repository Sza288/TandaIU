import { Praktikan } from '../types';

/**
 * Identitas Praktikan dummy. NIM tidak merepresentasikan data akademik resmi.
 * Semester 2 dan 4 tetap disimpan, tetapi tidak muncul pada demo semester ganjil.
 */
export const praktikans: Praktikan[] = [
  { id: 'p1', name: 'Andi Pratama', studentCode: '24060124120001', semester: 3 },
  { id: 'p2', name: 'Budi Santoso', studentCode: '24060124120002', semester: 1 },
  { id: 'p3', name: 'Citra Dewi', studentCode: '24060124120003', semester: 5 },
  { id: 'p4', name: 'Dewi Lestari', studentCode: '24060124120004', semester: 2 },
  { id: 'p5', name: 'Eka Putra', studentCode: '24060124120005', semester: 3 },
  { id: 'p6', name: 'Fajar Nugroho', studentCode: '24060124120006', semester: 4 },
];
