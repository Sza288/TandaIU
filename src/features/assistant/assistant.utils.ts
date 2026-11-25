import { Attendance, ExcuseReason, PracticumSession, Praktikan } from '../../types';
import { formatTime } from '../../utils/format';

export type AttendanceStatus = 'hadir' | 'belum_presensi' | 'izin' | 'sakit' | 'alpha';

export type AttendanceRecapItem = {
  praktikanId: string;
  praktikanName: string;
  studentCode?: string;
  semester: number;
  status: AttendanceStatus;
  attendedAt?: string;
  formattedTime?: string;
  excuseReason?: ExcuseReason;
};

export type AttendanceStats = {
  total: number;
  hadir: number;
  izin: number;
  sakit: number;
  belumPresensi: number;
  alpha: number;
};

export function formatAttendanceTime(isoString?: string): string {
  if (!isoString) return '-';
  const time = formatTime(isoString);
  return time === '--:--' ? '-' : `${time} WIB`;
}

export function deriveAttendanceRecap(
  sessionId: string,
  attendances: Attendance[],
  enrolledPraktikans: Praktikan[],
  isClosed = false
): AttendanceRecapItem[] {
  if (!sessionId || !enrolledPraktikans) return [];

  const sessionAttendances = attendances.filter(
    (attendance) => attendance.sessionId === sessionId
  );

  const attendanceMap = new Map<string, Attendance>();
  for (const item of sessionAttendances) {
    if (!attendanceMap.has(item.praktikanId)) {
      attendanceMap.set(item.praktikanId, item);
    }
  }

  return enrolledPraktikans.map((praktikan) => {
    const record = attendanceMap.get(praktikan.id);
    const status: AttendanceStatus = record?.status === 'izin'
      ? record.excuseReason === 'sakit' ? 'sakit' : 'izin'
      : record?.status === 'dibatalkan'
        ? isClosed ? 'alpha' : 'belum_presensi'
        : record
          ? 'hadir'
          : isClosed
            ? 'alpha'
            : 'belum_presensi';

    return {
      praktikanId: praktikan.id,
      praktikanName: praktikan.name,
      studentCode: praktikan.studentCode,
      semester: praktikan.semester,
      status,
      attendedAt: record?.attendedAt,
      formattedTime: record?.attendedAt ? formatAttendanceTime(record.attendedAt) : undefined,
      excuseReason: record?.excuseReason,
    };
  });
}

export type ClassRecapMeeting = {
  sessionId: string;
  meetingNumber: number;
  status: PracticumSession['status'];
  startsAt: string;
  endsAt: string;
};

export type ClassRecapStudent = {
  praktikanId: string;
  praktikanName: string;
  studentCode?: string;
  semester: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  belumPresensi: number;
  attendanceRate: number;
};

export type ClassRecap = {
  meetings: ClassRecapMeeting[];
  students: ClassRecapStudent[];
  totalMeetings: number;
  closedMeetings: number;
};

/**
 * Rekap satu kelas lintas pertemuan yang sudah/akan berlangsung. Hanya sesi
 * berstatus `ditutup` yang dihitung alpha, sama seperti rekap per sesi, agar
 * pertemuan yang belum selesai tidak menumpuk sebagai alpha.
 */
export function buildClassRecap({
  sessions,
  attendances,
  enrollments,
}: {
  sessions: PracticumSession[];
  attendances: Attendance[];
  enrollments: { praktikanId: string; praktikanName: string; studentCode?: string; semester: number }[];
}): ClassRecap {
  const orderedSessions = [...sessions].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );

  const meetings: ClassRecapMeeting[] = orderedSessions.map((session, index) => ({
    sessionId: session.id,
    meetingNumber: index + 1,
    status: session.status,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
  }));

  const attendanceByKey = new Map<string, Attendance>();
  for (const attendance of attendances) {
    const key = `${attendance.sessionId}::${attendance.praktikanId}`;
    if (!attendanceByKey.has(key)) attendanceByKey.set(key, attendance);
  }

  const students: ClassRecapStudent[] = enrollments
    .map((enrollment) => {
      let hadir = 0;
      let izin = 0;
      let sakit = 0;
      let alpha = 0;
      let belumPresensi = 0;

      for (const session of orderedSessions) {
        const record = attendanceByKey.get(`${session.id}::${enrollment.praktikanId}`);
        if (record) {
          if (record.status === 'izin') {
            if (record.excuseReason === 'sakit') sakit += 1;
            else izin += 1;
          } else {
            hadir += 1;
          }
        } else if (session.status === 'ditutup') {
          alpha += 1;
        } else {
          belumPresensi += 1;
        }
      }

      const total = orderedSessions.length;
      return {
        praktikanId: enrollment.praktikanId,
        praktikanName: enrollment.praktikanName,
        studentCode: enrollment.studentCode,
        semester: enrollment.semester,
        hadir,
        izin,
        sakit,
        alpha,
        belumPresensi,
        attendanceRate: total === 0 ? 0 : hadir / total,
      };
    })
    .sort((a, b) => a.praktikanName.localeCompare(b.praktikanName, 'id'));

  return {
    meetings,
    students,
    totalMeetings: meetings.length,
    closedMeetings: meetings.filter((meeting) => meeting.status === 'ditutup').length,
  };
}

export function calculateAttendanceStats(recapItems: AttendanceRecapItem[]): AttendanceStats {
  const stats: AttendanceStats = {
    total: recapItems.length,
    hadir: 0,
    izin: 0,
    sakit: 0,
    belumPresensi: 0,
    alpha: 0,
  };

  for (const item of recapItems) {
    if (item.status === 'hadir') {
      stats.hadir += 1;
    } else if (item.status === 'izin') {
      stats.izin += 1;
    } else if (item.status === 'sakit') {
      stats.sakit += 1;
    } else if (item.status === 'alpha') {
      stats.alpha += 1;
    } else {
      stats.belumPresensi += 1;
    }
  }

  return stats;
}
