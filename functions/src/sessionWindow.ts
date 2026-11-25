export type SessionTimeFailure =
  | 'SESSION_TIME_INVALID'
  | 'SESSION_NOT_STARTED'
  | 'SESSION_ENDED';

export function getSessionTimeFailure(
  startsAt: number | null,
  endsAt: number | null,
  currentTime: number,
): SessionTimeFailure | null {
  if (startsAt === null || endsAt === null
    || !Number.isFinite(startsAt)
    || !Number.isFinite(endsAt)
    || !Number.isFinite(currentTime)
    || endsAt <= startsAt) {
    return 'SESSION_TIME_INVALID';
  }
  if (currentTime < startsAt) return 'SESSION_NOT_STARTED';
  if (currentTime >= endsAt) return 'SESSION_ENDED';
  return null;
}
