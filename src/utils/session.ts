import { PracticumSession } from '../types';

/**
 * Kontrak PracticumSession (SRS bagian 6) tidak menyimpan nomor pertemuan,
 * jadi nomor pertemuan diturunkan secara stabil dari id sesi hanya untuk
 * tampilan demo.
 */
export function getMeetingNumber(session: PracticumSession): number {
  const digits = session.id.replace(/\D/g, '');
  const value = Number(digits);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return ((value - 1) % 6) + 1;
}

export function getLabLabel(session: PracticumSession): string {
  return `Lab ${session.className}`;
}
