import { AcademicTerm } from '../types';

/**
 * Konfigurasi demo. Ubah nilai ini jika demo berpindah ke semester genap.
 * Ini adalah semester akademik aktif, bukan semester milik Praktikan.
 */
export const ACTIVE_ACADEMIC_TERM: AcademicTerm = 'ganjil';

export const ACADEMIC_TERM_LABELS: Record<AcademicTerm, string> = {
  ganjil: 'Ganjil',
  genap: 'Genap',
};

export const ACTIVE_ACADEMIC_TERM_LABEL =
  ACADEMIC_TERM_LABELS[ACTIVE_ACADEMIC_TERM];
