import {
  buildSchedulePlan,
  INJECTED_ROOM_LABEL,
  type ExistingSession,
} from '../migrations/schedulesFromSessions';

function session(overrides: Partial<ExistingSession> = {}): ExistingSession {
  return {
    id: 's1',
    classId: 'class-1',
    courseId: 'course-1',
    // Senin 08:00-10:00 WIB
    startsAt: '2026-11-23T01:00:00.000Z',
    endsAt: '2026-11-23T03:00:00.000Z',
    semesterParity: 'ganjil',
    assistantUid: 'uid-1',
    hasScheduleId: false,
    ...overrides,
  };
}

describe('buildSchedulePlan', () => {
  it('groups sessions of the same class, day, and time into one schedule', () => {
    const plan = buildSchedulePlan([
      session({ id: 's1' }),
      session({ id: 's2', startsAt: '2026-11-30T01:00:00.000Z', endsAt: '2026-11-30T03:00:00.000Z' }),
    ]);

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].sessionIds).toEqual(['s1', 's2']);
    expect(plan.items[0].jumlahPertemuan).toBe(2);
  });

  it('uses the session time as WIB wall time for day and clock fields', () => {
    const [item] = buildSchedulePlan([session()]).items;

    expect(item.dayOfWeek).toBe(1);
    expect(item.startTime).toBe('08:00');
    expect(item.endTime).toBe('10:00');
  });

  it('creates separate schedules for different times in the same class', () => {
    const plan = buildSchedulePlan([
      session({ id: 's1' }),
      session({ id: 's2', startsAt: '2026-11-24T06:30:00.000Z', endsAt: '2026-11-24T08:30:00.000Z' }),
    ]);

    expect(plan.items).toHaveLength(2);
  });

  it('never derives the room from the laboratory', () => {
    const [item] = buildSchedulePlan([session()]).items;
    expect(item.room).toBe(INJECTED_ROOM_LABEL);
  });

  it('skips sessions that already carry a scheduleId', () => {
    const plan = buildSchedulePlan([
      session({ id: 's1', hasScheduleId: true }),
      session({ id: 's2', startsAt: '2026-11-30T01:00:00.000Z', endsAt: '2026-11-30T03:00:00.000Z' }),
    ]);

    expect(plan.sessionsSkippedAlreadyLinked).toBe(1);
    expect(plan.items[0].sessionIds).toEqual(['s2']);
  });

  it('reports sessions without class, course, parity, or owner as invalid', () => {
    const plan = buildSchedulePlan([
      session({ id: 's1', classId: '' }),
      session({ id: 's2', assistantUid: '' }),
    ]);

    expect(plan.invalidSessionIds).toEqual(['s1', 's2']);
    expect(plan.items).toHaveLength(0);
  });

  it('reports sessions with unparsable times instead of guessing', () => {
    const plan = buildSchedulePlan([session({ id: 's1', startsAt: '' })]);

    expect(plan.sessionsSkippedInvalid).toEqual(['s1']);
    expect(plan.items).toHaveLength(0);
  });
});
