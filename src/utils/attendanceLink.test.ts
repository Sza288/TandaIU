import {
  ATTENDANCE_WEB_ORIGIN,
  ATTENDANCE_WEB_PATH,
  createAttendanceLink,
  parseAttendanceLink,
} from './attendanceLink';

describe('attendance link', () => {
  it('creates an HTTPS link with the session ID encoded in the attendance route', () => {
    const link = createAttendanceLink('session 42');
    const url = new URL(link);

    expect(url.protocol).toBe('https:');
    expect(url.origin).toBe(ATTENDANCE_WEB_ORIGIN);
    expect(url.pathname).toBe(ATTENDANCE_WEB_PATH);
    expect(url.searchParams.get('sessionId')).toBe('session 42');
  });

  it('parses only links for the configured attendance route and returns its session ID', () => {
    const link = createAttendanceLink('session-42');

    expect(link).toBe(
      `${ATTENDANCE_WEB_ORIGIN}${ATTENDANCE_WEB_PATH}?sessionId=session-42`,
    );
    expect(parseAttendanceLink(link)).toBe('session-42');
    expect(parseAttendanceLink('https://example.com/praktikan/attendance?sessionId=session-42'))
      .toBeNull();
    expect(parseAttendanceLink(`${ATTENDANCE_WEB_ORIGIN}/`)).toBeNull();
    expect(parseAttendanceLink('not a URL')).toBeNull();
  });

  it('does not generate a link without a session ID', () => {
    expect(createAttendanceLink('  ')).toBe('');
  });
});
