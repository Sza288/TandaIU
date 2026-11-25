import { PracticumSession } from '../types';

type MeetingSession = {
  id: string;
  startsAt: string;
  classId?: string;
  courseId?: string;
  className?: string;
};

function meetingGroupKey(session: MeetingSession): string {
  return session.classId || `${session.courseId ?? ''}::${session.className ?? ''}`;
}

export function getMeetingNumber(
  session: PracticumSession,
  sessions: PracticumSession[] = [session],
): number {
  const key = meetingGroupKey(session);
  const ordered = sessions
    .filter((item) => meetingGroupKey(item) === key)
    .slice()
    .sort((a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  const index = ordered.findIndex((item) => item.id === session.id);
  return index >= 0 ? index + 1 : 1;
}

export function getLabLabel(session: PracticumSession): string {
  return `Lab ${session.className}`;
}
