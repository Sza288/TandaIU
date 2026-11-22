export type SessionStatus = 'terjadwal' | 'dibuka' | 'ditutup';

// Semester parity is used for term ownership; allow future curriculum terms.
export type Semester = number;

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
  startsAt: string; // ISO 8601 in app models; Firestore stores Timestamp.
  endsAt: string;   // ISO 8601 in app models; Firestore stores Timestamp.
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
  attendedAt: string; // ISO 8601 in app models; new Firestore writes use serverTimestamp.
  status?: 'hadir' | 'izin';
  excuseReason?: ExcuseReason;
};

export type Role = 'asisten' | 'praktikan';

export type MutationResult = {
  ok: boolean;
  reason?: string;
};
