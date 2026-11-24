import type { Attendance, Praktikan } from '../../types';
import { calculateAttendanceStats, deriveAttendanceRecap } from './assistant.utils';

const enrolled: Praktikan[] = [{
  id: 'student-1',
  name: 'Praktikan Satu',
  semester: 3,
}];

describe('attendance recap cancellation', () => {
  it('does not count a cancelled attendance as present in a closed-session recap', () => {
    const records: Attendance[] = [{
      sessionId: 'session-1',
      praktikanId: 'student-1',
      attendedAt: '2026-11-23T10:00:00.000Z',
      status: 'dibatalkan',
      attendanceMethod: 'qr',
      latitude: -6.9,
      longitude: 110.4,
    }];

    const recap = deriveAttendanceRecap('session-1', records, enrolled, true);

    expect(recap[0].status).toBe('alpha');
    expect(calculateAttendanceStats(recap)).toMatchObject({
      hadir: 0,
      alpha: 1,
    });
  });
});
