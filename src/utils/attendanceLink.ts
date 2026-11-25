export const ATTENDANCE_WEB_ORIGIN = 'https://presensi-praktikum-80d68.web.app';
export const ATTENDANCE_WEB_PATH = '/praktikan/attendance';

export function createAttendanceLink(sessionId: string): string {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) return '';

  const url = new URL(ATTENDANCE_WEB_PATH, ATTENDANCE_WEB_ORIGIN);
  url.searchParams.set('sessionId', normalizedSessionId);
  return url.toString();
}

export function parseAttendanceLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== ATTENDANCE_WEB_ORIGIN || url.pathname !== ATTENDANCE_WEB_PATH) {
      return null;
    }

    const sessionId = url.searchParams.get('sessionId')?.trim();
    return sessionId || null;
  } catch {
    return null;
  }
}
