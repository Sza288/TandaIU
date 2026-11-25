import { parseAttendanceQrPayload } from './attendanceQr';

describe('attendance QR payload parsing', () => {
  it('accepts a versioned random token payload', () => {
    const token = 'A'.repeat(43);
    expect(parseAttendanceQrPayload(`TANDAIU-ATTENDANCE:1:${token}`)).toBe(token);
  });

  it.each([
    '',
    'https://tandaiu.example/session/s1',
    `TANDAIU-ATTENDANCE:1:${'A'.repeat(42)}`,
    `TANDAIU-ATTENDANCE:2:${'A'.repeat(43)}`,
    `TANDAIU-ATTENDANCE:1:${'A'.repeat(44)}`,
  ])('rejects malformed QR payload %s', (payload) => {
    expect(parseAttendanceQrPayload(payload)).toBeNull();
  });
});
