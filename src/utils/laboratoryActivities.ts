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
  scheduleId?: string;
  room?: string;
};

export type LaboratoryActivities = {
  ongoing: LaboratoryActivity[];
  next: LaboratoryActivity | null;
};

function isValidTimeRange(session: LaboratorySessionRecord): boolean {
  const startsAt = Date.parse(session.startsAt);
  const endsAt = Date.parse(session.endsAt);
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt >= startsAt;
}

function toActivity(
  session: LaboratorySessionRecord,
  schedulesById: ReadonlyMap<string, LaboratoryScheduleRecord>,
): LaboratoryActivity {
  const schedule = session.scheduleId
    ? schedulesById.get(session.scheduleId)
    : undefined;

  return {
    id: session.id,
    practicumName: session.practicumName,
    className: session.className,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    status: session.status,
    ...(session.scheduleId ? { scheduleId: session.scheduleId } : {}),
    ...(schedule?.room ? { room: schedule.room } : {}),
  };
}

export function processLaboratoryActivities(
  laboratoryId: string,
  schedules: LaboratoryScheduleRecord[],
  sessions: LaboratorySessionRecord[],
  nowMs: number,
): LaboratoryActivities {
  const schedulesById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const laboratorySessions = sessions.filter(
    (session) => session.laboratoryId === laboratoryId && isValidTimeRange(session),
  );
  const openSessions = laboratorySessions
    .filter((session) => session.status === 'dibuka')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const ongoingSessions = openSessions.length > 0
    ? openSessions
    : laboratorySessions.filter((session) => {
      if (session.status === 'ditutup') return false;
      const startsAt = Date.parse(session.startsAt);
      const endsAt = Date.parse(session.endsAt);
      return startsAt <= nowMs && nowMs <= endsAt;
    });

  const ongoingIds = new Set(ongoingSessions.map((session) => session.id));
  const nextSession = laboratorySessions
    .filter((session) =>
      session.status === 'terjadwal'
      && Date.parse(session.startsAt) > nowMs
      && !ongoingIds.has(session.id),
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];

  return {
    ongoing: ongoingSessions.map((session) => toActivity(session, schedulesById)),
    next: nextSession ? toActivity(nextSession, schedulesById) : null,
  };
}
