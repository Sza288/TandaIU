import { Attendance, ExcuseReason, Praktikan } from '../../types';
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
