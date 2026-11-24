import type {
  LaboratoryScheduleRecord,
  LaboratorySessionRecord,
} from '../types/laboratorium';

export type LaboratoryActivity = {
  id: string;
  practicumName: string;
  className: string;
  startsAt: string;
  endsAt: string;
  status: LaboratorySessionRecord['status'];
  sessionId?: string;
  scheduleId?: string;
};

export type LaboratoryActivities = {
  ongoing: LaboratoryActivity[];
  next: LaboratoryActivity | null;
};

type ScheduleBounds = {
  startsAt: string;
  endsAt: string;
  startsMs: number;
  endsMs: number;
};

function parseClockTime(clockTime: string): { hours: number; minutes: number } {
  const [hours, minutes] = clockTime.split(':').map(Number);
  return { hours, minutes };
}

function getJakartaDateParts(nowMs: number): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(values.get('year'));
  const month = Number(values.get('month'));
  const day = Number(values.get('day'));
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return { year, month, day, dayOfWeek: utcDate.getUTCDay() };
}

function formatJakartaIso(year: number, month: number, day: number, clockTime: string): string {
  const { hours, minutes } = parseClockTime(clockTime);
  const monthValue = String(month).padStart(2, '0');
  const dayValue = String(day).padStart(2, '0');
  const hoursValue = String(hours).padStart(2, '0');
  const minutesValue = String(minutes).padStart(2, '0');
  return `${year}-${monthValue}-${dayValue}T${hoursValue}:${minutesValue}:00+07:00`;
}

function getScheduleBounds(schedule: LaboratoryScheduleRecord, nowMs: number): ScheduleBounds {
  const jakarta = getJakartaDateParts(nowMs);
  const todayUtc = new Date(Date.UTC(jakarta.year, jakarta.month - 1, jakarta.day));
  const offset = schedule.dayOfWeek - jakarta.dayOfWeek;
  todayUtc.setUTCDate(todayUtc.getUTCDate() + offset);

  const year = todayUtc.getUTCFullYear();
  const month = todayUtc.getUTCMonth() + 1;
  const day = todayUtc.getUTCDate();
  const startsAt = formatJakartaIso(year, month, day, schedule.startTime);
  const endsAt = formatJakartaIso(year, month, day, schedule.endTime);

  return {
    startsAt,
    endsAt,
    startsMs: Date.parse(startsAt),
    endsMs: Date.parse(endsAt),
  };
}

function getMatchingSession(
  schedule: LaboratoryScheduleRecord,
  sessions: LaboratorySessionRecord[],
  laboratoryId: string,
  bounds: ScheduleBounds,
): LaboratorySessionRecord | undefined {
  return sessions.find((session) => {
    if (session.laboratoryId !== laboratoryId) return false;
    if (schedule.sessionId && session.id === schedule.sessionId) return true;
    if (session.classId !== schedule.classId || session.courseId !== schedule.courseId) return false;

    const sessionStart = Date.parse(session.startsAt);
    const sessionEnd = Date.parse(session.endsAt);
    return sessionStart <= bounds.endsMs && sessionEnd >= bounds.startsMs;
  });
}

export function processLaboratoryActivities(
  laboratoryId: string,
  schedules: LaboratoryScheduleRecord[],
  sessions: LaboratorySessionRecord[],
  nowMs: number,
): LaboratoryActivities {
  const laboratorySchedules = schedules.filter(
    (schedule) => schedule.laboratoryId === laboratoryId,
  );
  const laboratorySessions = sessions.filter(
    (session) => session.laboratoryId === laboratoryId,
  );
  const openSessions = laboratorySessions
    .filter((session) => session.status === 'dibuka')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  let ongoing: LaboratoryActivity[];

  if (openSessions.length > 0) {
    ongoing = openSessions.map((session) => ({
      id: session.id,
      sessionId: session.id,
      practicumName: session.practicumName,
      className: session.className,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      status: 'dibuka',
    }));
  } else {
    ongoing = [];
    for (const schedule of laboratorySchedules) {
      const bounds = getScheduleBounds(schedule, nowMs);
      if (nowMs < bounds.startsMs || nowMs > bounds.endsMs) continue;

      const matchingSession = getMatchingSession(
        schedule,
        laboratorySessions,
        laboratoryId,
        bounds,
      );
      if (matchingSession?.status === 'ditutup') continue;

      ongoing.push({
        id: matchingSession?.id ?? schedule.id,
        ...(matchingSession ? { sessionId: matchingSession.id } : {}),
        scheduleId: schedule.id,
        practicumName: matchingSession?.practicumName ?? schedule.practicumName,
        className: matchingSession?.className ?? schedule.className,
        startsAt: matchingSession?.startsAt ?? bounds.startsAt,
        endsAt: matchingSession?.endsAt ?? bounds.endsAt,
        status: matchingSession?.status ?? 'terjadwal',
      });
    }
  }

  const ongoingSessionIds = new Set(
    ongoing.flatMap((activity) => activity.sessionId ? [activity.sessionId] : []),
  );
  const ongoingScheduleIds = new Set(
    ongoing.flatMap((activity) => activity.scheduleId ? [activity.scheduleId] : []),
  );

  const nextCandidates = laboratorySchedules
    .map((schedule) => {
      const bounds = getScheduleBounds(schedule, nowMs);
      const matchingSession = getMatchingSession(
        schedule,
        laboratorySessions,
        laboratoryId,
        bounds,
      );
      return { schedule, bounds, matchingSession };
    })
    .filter(({ schedule, bounds, matchingSession }) => {
      if (bounds.startsMs <= nowMs) return false;
      if (ongoingScheduleIds.has(schedule.id)) return false;
      if (!matchingSession) return true;
      return matchingSession.status === 'terjadwal'
        && !ongoingSessionIds.has(matchingSession.id);
    })
    .sort((a, b) => a.bounds.startsMs - b.bounds.startsMs);

  const next = nextCandidates[0];
  const nextActivity = next
    ? {
      id: next.matchingSession?.id ?? next.schedule.id,
      ...(next.matchingSession ? { sessionId: next.matchingSession.id } : {}),
      scheduleId: next.schedule.id,
      practicumName: next.matchingSession?.practicumName ?? next.schedule.practicumName,
      className: next.matchingSession?.className ?? next.schedule.className,
      startsAt: next.matchingSession?.startsAt ?? next.bounds.startsAt,
      endsAt: next.matchingSession?.endsAt ?? next.bounds.endsAt,
      status: next.matchingSession?.status ?? 'terjadwal',
    }
    : null;

  return { ongoing, next: nextActivity };
}
