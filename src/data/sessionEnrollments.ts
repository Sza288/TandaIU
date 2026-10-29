import { courses } from './courses';
import { praktikans } from './praktikans';
import { initialSessions } from './sessions';

const courseSemesters = new Map(courses.map((course) => [course.id, course.semester]));

const SESSION_ENROLLMENTS: Record<string, string[]> = Object.fromEntries(
  initialSessions.map((session) => {
    const semester = courseSemesters.get(session.courseId);
    const praktikanIds = semester === undefined
      ? []
      : praktikans
        .filter((praktikan) => praktikan.semester === semester)
        .map((praktikan) => praktikan.id);

    return [session.id, praktikanIds];
  }),
);

export function getSessionIdsForPraktikan(praktikanId: string): string[] {
  return Object.entries(SESSION_ENROLLMENTS)
    .filter(([, praktikanIds]) => praktikanIds.includes(praktikanId))
    .map(([sessionId]) => sessionId);
}

export function getPraktikanIdsForSession(sessionId: string): string[] {
  return [...(SESSION_ENROLLMENTS[sessionId] ?? [])];
}
