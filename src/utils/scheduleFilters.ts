import type { PracticumSession } from '../types';

export type ScheduleStatusFilter = 'semua' | 'dibuka' | 'terlewati' | 'mendatang';

export type ScheduleStatusSession = Pick<
  PracticumSession,
  'status' | 'startsAt' | 'endsAt'
>;

/**
 * Status sesi adalah acuan utama (S3-SRS-12); jam jadwal hanya pelengkap.
 * Sesi yang sedang dibuka tetap masuk kategori "dibuka" meskipun rentang
 * jadwalnya sudah lewat, karena asisten belum menutupnya.
 */
export function getScheduleStatusCategory(
  session: ScheduleStatusSession,
  now = Date.now(),
): Exclude<ScheduleStatusFilter, 'semua'> {
  if (session.status === 'dibuka') return 'dibuka';
  if (session.status === 'ditutup') return 'terlewati';

  const startTime = Date.parse(session.startsAt);
  if (Number.isFinite(startTime) && startTime <= now) return 'terlewati';
  return 'mendatang';
}

export function matchesScheduleStatus(
  session: ScheduleStatusSession,
  filter: ScheduleStatusFilter,
  now = Date.now(),
): boolean {
  return filter === 'semua' || getScheduleStatusCategory(session, now) === filter;
}

export function matchesScheduleSearch(
  values: readonly string[],
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
  if (!normalizedQuery) return true;
  return values.some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedQuery));
}

export function matchesScheduleEntry(
  session: ScheduleStatusSession,
  values: readonly string[],
  filter: ScheduleStatusFilter,
  query: string,
  now = Date.now(),
): boolean {
  return matchesScheduleStatus(session, filter, now)
    && matchesScheduleSearch(values, query);
}
