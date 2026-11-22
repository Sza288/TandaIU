import { firestoreDateToIso, isoToFirestoreDate } from './firestoreDate';

describe('Firestore date boundary helpers', () => {
  it('serializes valid app ISO input as a Date for Firestore Timestamp storage', () => {
    const value = isoToFirestoreDate('2026-11-22T10:15:00.000Z');

    expect(value).toBeInstanceOf(Date);
    expect(value.toISOString()).toBe('2026-11-22T10:15:00.000Z');
  });

  it('normalizes Firestore Timestamp-like values while retaining legacy ISO strings', () => {
    const date = new Date('2026-11-22T10:15:00.000Z');

    expect(firestoreDateToIso({ toDate: () => date })).toBe(date.toISOString());
    expect(firestoreDateToIso('2026-11-22T10:15:00.000Z')).toBe(date.toISOString());
  });

  it('rejects invalid ISO values and safely handles invalid Firestore values', () => {
    expect(() => isoToFirestoreDate('not-a-date')).toThrow(/ISO/);
    expect(firestoreDateToIso(undefined)).toBe('');
  });
});
