import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../lib/firebase';
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

function toSemester(value: unknown): Semester {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : 1;
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
