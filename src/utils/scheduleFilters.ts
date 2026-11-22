import type { PracticumSession } from '../types';

export type ScheduleStatusFilter = 'semua' | 'dibuka' | 'terlewati' | 'mendatang';

export type ScheduleStatusSession = Pick<
  PracticumSession,
  'status' | 'startsAt' | 'endsAt'
>;

export function getScheduleStatusCategory(
  session: ScheduleStatusSession,
  now = Date.now(),
): Exclude<ScheduleStatusFilter, 'semua'> {
  if (session.status === 'ditutup') return 'terlewati';

  const startTime = Date.parse(session.startsAt);
  const endTime = Date.parse(session.endsAt);
  // A session left in "dibuka" after its end is no longer an active option.
  // Keep the persisted state as the category only while its attendance window
  // has not elapsed.
  if (session.status === 'dibuka' && (!Number.isFinite(endTime) || endTime > now)) {
    return 'dibuka';
  }
  if (
    (Number.isFinite(startTime) && startTime <= now)
    || (Number.isFinite(endTime) && endTime <= now)
  ) return 'terlewati';
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
