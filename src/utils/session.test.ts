import { PracticumSession } from '../types';
import { getLabLabel, getMeetingNumber } from './session';

function sessionWith(id: string, startsAt: string, className = 'A1'): PracticumSession {
  return {
    id,
    courseId: 'course-1',
    practicumName: 'Praktikum',
    className,
    startsAt,
    endsAt: startsAt,
    status: 'terjadwal',
  };
}

describe('getMeetingNumber (FR-03)', () => {
  it('uses chronological order within the same class', () => {
    const sessions = [
      sessionWith('abc123', '2026-10-20T08:00:00.000Z'),
      sessionWith('xyz999', '2026-10-13T08:00:00.000Z'),
      sessionWith('def456', '2026-10-27T08:00:00.000Z'),
    ];

    expect(getMeetingNumber(sessions[0], sessions)).toBe(2);
    expect(getMeetingNumber(sessions[1], sessions)).toBe(1);
    expect(getMeetingNumber(sessions[2], sessions)).toBe(3);
  });

  it('does not mix meeting numbers across classes', () => {
    const sessions = [
      sessionWith('a', '2026-10-13T08:00:00.000Z'),
      sessionWith('b', '2026-10-20T08:00:00.000Z', 'A2'),
    ];

    expect(getMeetingNumber(sessions[0], sessions)).toBe(1);
    expect(getMeetingNumber(sessions[1], sessions)).toBe(1);
  });
});

describe('getLabLabel (FR-03)', () => {
  it('formats the class name as a lab label', () => {
    expect(getLabLabel(sessionWith('s1', '2026-10-13T08:00:00.000Z', 'C1'))).toBe('Lab C1');
  });
});
