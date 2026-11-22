import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { auth, db } from '../lib/firebase';
import type { Semester } from '../types';

export const ENROLLMENTS_COLLECTION = 'enrollments';

export type EnrollmentRecord = {
  id: string;
  praktikanId: string;
  praktikanName: string;
  studentCode: string;
  classId: string;
  courseId: string;
  semester: Semester;
  createdAt: string;
};

export type EnrollmentFilter = {
  praktikanId?: string;
  classId?: string;
};

export type EnrollmentListener = (records: EnrollmentRecord[]) => void;
export type EnrollmentErrorHandler = (message: string) => void;

export type StudentDirectoryRecord = {
  uid: string;
  name: string;
  studentCode: string;
  semester: Semester;
  semesterParity: 'ganjil' | 'genap';
};

export function subscribeToStudentDirectory(
  parity: 'ganjil' | 'genap',
  onData: (students: StudentDirectoryRecord[]) => void,
  onError?: EnrollmentErrorHandler,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'studentDirectory'), where('semesterParity', '==', parity)),
    (snapshot) => {
      const records = snapshot.docs.flatMap((item) => {
        const data = item.data();
        const semester = parseSemester(data.semester);
        const name = typeof data.name === 'string' ? data.name.trim() : '';
        const studentCode = typeof data.studentCode === 'string' ? data.studentCode.trim() : '';
        if (!semester || !name || !studentCode) return [];
        return [{ uid: item.id, name, studentCode, semester, semesterParity: parity }];
      });
      onData(records.sort((a, b) => a.name.localeCompare(b.name, 'id')));
    },
    (error) => onError?.(describeEnrollmentListenerError(error)),
  );
}

export async function createEnrollment(
  student: StudentDirectoryRecord,
  classId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi Asprak tidak tersedia.');
  const token = await user.getIdTokenResult();
  const parity = token.claims.assistantSemesterParity;
  if (parity !== 'ganjil' && parity !== 'genap') {
    throw new Error('Penugasan semester akun Asprak belum dikonfigurasi.');
  }

  const reference = doc(db, ENROLLMENTS_COLLECTION, `${classId}_${student.uid}`);
  await runTransaction(db, async (transaction) => {
    const classRef = doc(db, 'classes', classId);
    const directoryRef = doc(db, 'studentDirectory', student.uid);
    const [classSnapshot, directorySnapshot] = await Promise.all([
      transaction.get(classRef),
      transaction.get(directoryRef),
    ]);
    if (!classSnapshot.exists() || !directorySnapshot.exists()) {
      throw new Error('Data kelas atau identitas mahasiswa belum tersedia.');
    }
    const classData = classSnapshot.data();
    const directory = directorySnapshot.data();
    if (classData.assistantUid !== user.uid || classData.semesterParity !== parity) {
      throw new Error('Kelas berada di luar kewenangan semester akun ini.');
    }
    if (directory.semester !== classData.semester || directory.semesterParity !== parity
      || student.semester !== directory.semester || student.studentCode !== directory.studentCode) {
      throw new Error('Semester atau identitas mahasiswa tidak cocok dengan data resmi.');
    }
    transaction.set(reference, {
      praktikanId: student.uid,
      praktikanName: directory.name,
      studentCode: directory.studentCode,
      classId,
      courseId: classData.courseId,
      semester: directory.semester,
      createdAt: new Date().toISOString(),
    });
  });
}

function toSemester(value: unknown): Semester {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function parseSemester(value: unknown): Semester | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

export function mapEnrollment(id: string, data: DocumentData): EnrollmentRecord {
  return {
    id,
    praktikanId: String(data.praktikanId ?? '').trim(),
    praktikanName: String(data.praktikanName ?? 'Praktikan').trim() || 'Praktikan',
    studentCode: String(data.studentCode ?? '').trim(),
    classId: String(data.classId ?? '').trim(),
    courseId: String(data.courseId ?? '').trim(),
    semester: toSemester(data.semester),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
  };
}

export function describeEnrollmentListenerError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code.includes('permission-denied')) {
    return 'Akses data pendaftaran praktikum ditolak. Firestore Rules belum mengizinkan pembacaan enrollment untuk akun ini.';
  }
  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Data pendaftaran praktikum tidak dapat dimuat karena koneksi bermasalah.';
  }
  return 'Data pendaftaran praktikum tidak dapat dimuat. Coba lagi.';
}

export function subscribeToEnrollments(
  filter: EnrollmentFilter,
  onData: EnrollmentListener,
  onError?: EnrollmentErrorHandler,
  database: Firestore = db,
): Unsubscribe {
  const praktikanId = filter.praktikanId?.trim() ?? '';
  const classId = filter.classId?.trim() ?? '';
  const constraints: QueryConstraint[] = [];

  if (praktikanId) {
    constraints.push(where('praktikanId', '==', praktikanId));
  }
  if (classId) {
    constraints.push(where('classId', '==', classId));
  }

  if (constraints.length === 0) {
    onData([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(database, ENROLLMENTS_COLLECTION), ...constraints),
    (snapshot) => {
      const records = snapshot.docs
        .map((document) => mapEnrollment(document.id, document.data()))
        .sort((a, b) => {
          const byClass = a.classId.localeCompare(b.classId);
          return byClass !== 0 ? byClass : a.praktikanName.localeCompare(b.praktikanName);
        });
      onData(records);
    },
    (error) => onError?.(describeEnrollmentListenerError(error)),
  );
}

export function getEnrolledClassIds(records: readonly EnrollmentRecord[]): Set<string> {
  return new Set(records.map((record) => record.classId).filter(Boolean));
}
