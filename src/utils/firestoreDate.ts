/**
 * The app keeps date values as ISO strings. Firestore stores session dates as
 * Timestamp values; string support is retained only to display legacy records
 * until the separately approved Production migration is complete.
 */
export function firestoreDateToIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') {
      const date = toDate.call(value);
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  return '';
}

export function isoToFirestoreDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Waktu sesi harus berupa tanggal ISO yang valid.');
  }
  return date;
}
