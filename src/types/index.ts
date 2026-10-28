export type SessionStatus = 'terjadwal' | 'dibuka' | 'ditutup';

export type Semester = 1 | 2 | 3 | 4 | 5;

export type AcademicTerm = 'ganjil' | 'genap';

export type PracticumCourse = {
  id: string;
  name: string;
  semester: Semester;
};

export type PracticumSession = {
  id: string;
  courseId: string;
  practicumName: string;
  className: string;
  startsAt: string; // ISO 8601
  endsAt: string;   // ISO 8601
  status: SessionStatus;
};

export type Praktikan = {
  id: string;
  name: string;
  studentCode?: string;
  semester: Semester;
};

export type ExcuseReason = 'sakit' | 'izin-lainnya';

export type Attendance = {
  sessionId: string;
  praktikanId: string;
  attendedAt: string; // ISO 8601
  status?: 'hadir' | 'izin';
  excuseReason?: ExcuseReason;
};

export type Role = 'assistant' | 'praktikan';

export type MutationResult = {
  ok: boolean;
  reason?: string;
};
