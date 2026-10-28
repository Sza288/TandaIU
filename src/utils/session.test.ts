import { PracticumSession } from '../types';
import { getLabLabel, getMeetingNumber } from './session';

function sessionWith(id: string, className: string): PracticumSession {
  return { id, className } as PracticumSession;
}

describe('getMeetingNumber (FR-03)', () => {
  it('derives a stable 1..6 meeting number from the session id', () => {
    expect(getMeetingNumber(sessionWith('s1', 'A1'))).toBe(1);
    expect(getMeetingNumber(sessionWith('s5', 'A1'))).toBe(5);
    expect(getMeetingNumber(sessionWith('s6', 'A1'))).toBe(6);
    expect(getMeetingNumber(sessionWith('s7', 'A1'))).toBe(1);
    expect(getMeetingNumber(sessionWith('s12', 'A1'))).toBe(6);
  });

  it('falls back to 1 for ids without usable digits', () => {
    expect(getMeetingNumber(sessionWith('sesi', 'A1'))).toBe(1);
  });
});

describe('getLabLabel (FR-03)', () => {
  it('formats the class name as a lab label', () => {
    expect(getLabLabel(sessionWith('s1', 'C1'))).toBe('Lab C1');
  });
});
