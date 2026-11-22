import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

import { dosen } from '../data/dosen';
import { courses } from '../data/courses';
import type { SessionStatus } from '../types';
import { firestoreDateToIso, isoToFirestoreDate } from '../utils/firestoreDate';
import {
  COLLECTIONS,
  type ClassDoc,
  type ClassInput,
  type ClockTime,
  type LecturerId,
  type ScheduleDoc,
  type ScheduleInput,
  type SessionDoc,
  type SessionInput,
} from '../types/praktikum';

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const SESSION_STATUSES: SessionStatus[] = ['terjadwal', 'dibuka', 'ditutup'];

function requireNonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} wajib diisi.`);
  }
}

function parseIsoDateTime(value: string, label: string): number {
  requireNonEmpty(value, label);
  const timestamp = Date.parse(value);
  if (!ISO_DATE_TIME_PATTERN.test(value) || Number.isNaN(timestamp)) {
    throw new Error(`${label} harus berupa tanggal ISO yang valid.`);
  }
  return timestamp;
}

function parseClockTime(value: ClockTime, label: string): number {
  if (!CLOCK_TIME_PATTERN.test(value)) {
    throw new Error(`${label} harus berformat HH:mm.`);
  }
  const [hours, minutes] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function validateClassInput(input: ClassInput): void {
  requireNonEmpty(input.courseId, 'Mata kuliah');
  requireNonEmpty(input.className, 'Nama kelas');
  requireNonEmpty(input.createdAt, 'Tanggal dibuat');
  if (Number.isNaN(Date.parse(input.createdAt))) {
    throw new Error('Tanggal dibuat harus berupa tanggal yang valid.');
  }
}

export function validateScheduleInput(input: ScheduleInput): void {
  requireNonEmpty(input.classId, 'Kelas');
  requireNonEmpty(input.courseId, 'Mata kuliah');
  requireNonEmpty(input.room, 'Ruangan');

  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 0 ||
    input.dayOfWeek > 6
  ) {
    throw new Error('Hari harus berupa angka 0 sampai 6.');
  }

  const startMinutes = parseClockTime(input.startTime, 'Waktu mulai');
  const endMinutes = parseClockTime(input.endTime, 'Waktu selesai');
  if (endMinutes <= startMinutes) {
    throw new Error('Waktu selesai harus setelah waktu mulai.');
  }
}

export function validateSessionInput(input: SessionInput): void {
  requireNonEmpty(input.classId, 'Kelas');
  requireNonEmpty(input.courseId, 'Mata kuliah');
  requireNonEmpty(input.practicumName, 'Nama praktikum');
  requireNonEmpty(input.className, 'Nama kelas');

  const startTimestamp = parseIsoDateTime(input.startsAt, 'Waktu mulai');
  const endTimestamp = parseIsoDateTime(input.endsAt, 'Waktu selesai');
  if (endTimestamp <= startTimestamp) {
    throw new Error('Waktu selesai harus setelah waktu mulai.');
  }

  if (!SESSION_STATUSES.includes(input.status)) {
    throw new Error('Status sesi tidak valid.');
  }
}

function resolveLecturer(lecturerId: LecturerId, lecturer: string): string {
  const selected = dosen.find((item) => item.id === lecturerId);
  if (!selected) {
    throw new Error('Dosen tidak ditemukan.');
  }
  requireNonEmpty(lecturer, 'Nama dosen');
  if (lecturer.trim() !== selected.name) {
    throw new Error('Nama dosen harus sesuai dengan dosen yang dipilih.');
  }
  return selected.name;
}

async function resolveSessionClass(
  classId: string,
  courseId: string,
): Promise<ClassDoc> {
  const selected = await getClassById(classId);
  if (!selected) {
    throw new Error('Kelas tidak ditemukan.');
  }
  if (selected.courseId !== courseId) {
    throw new Error('Kelas tidak sesuai dengan mata kuliah yang dipilih.');
  }
  const course = courses.find((item) => item.id === courseId);
  if (!course || course.semester !== selected.semester) {
    throw new Error('Semester kelas tidak sesuai dengan data mata kuliah.');
  }
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || selected.assistantUid !== currentUid || !selected.semester) {
    throw new Error('Penanggung jawab atau semester kelas belum dikonfigurasi.');
  }
  return selected;
}

async function buildOwnedClassInput(input: ClassInput): Promise<ClassInput> {
  const user = auth.currentUser;
  const course = courses.find((item) => item.id === input.courseId);
  if (!user || !course) throw new Error('Akun Asprak atau mata kuliah tidak valid.');
  const token = await user.getIdTokenResult();
  const parity = token.claims.assistantSemesterParity;
  if ((course.semester % 2 === 1 && parity !== 'ganjil')
    || (course.semester % 2 === 0 && parity !== 'genap')) {
    throw new Error('Mata kuliah berada di luar semester tanggung jawab akun ini.');
  }
  return {
    ...input,
    semester: course.semester,
    semesterParity: course.semester % 2 === 1 ? 'ganjil' : 'genap',
    assistantUid: user.uid,
  };
}

type FirestoreErrorLike = {
  code?: unknown;
};

function mapFirestoreError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as FirestoreErrorLike).code)
      : '';

  if (code.includes('permission-denied')) {
    return new Error('Anda tidak memiliki izin untuk melakukan aksi ini');
  }
  if (code.includes('unavailable')) {
    return new Error('Koneksi bermasalah, coba lagi');
  }
  return new Error('Terjadi kesalahan saat menghubungi server. Silakan coba lagi.');
}

async function runFirestore<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export async function createClass(input: ClassInput): Promise<ClassDoc> {
  validateClassInput(input);
  const ownedInput = await buildOwnedClassInput(input);
  return runFirestore(async () => {
    const reference = await addDoc(collection(db, COLLECTIONS.classes), ownedInput);
    return { id: reference.id, ...ownedInput };
  });
}

export async function updateClass(
  id: string,
  input: ClassInput,
): Promise<ClassDoc> {
  validateClassInput(input);
  return runFirestore(async () => {
    const current = await getClassById(id);
    const ownedInput = await buildOwnedClassInput(input);
    if (!current || current.assistantUid !== auth.currentUser?.uid
      || current.semester !== ownedInput.semester) {
      throw new Error('Kelas tidak ditemukan atau berada di luar kewenangan akun ini.');
    }
    const payload = { ...ownedInput, assistantUid: current.assistantUid };
    await updateDoc(doc(db, COLLECTIONS.classes, id), payload);
    return { id, ...payload };
  });
}

export async function getClassById(id: string): Promise<ClassDoc | null> {
  return runFirestore(async () => {
    const snapshot = await getDoc(doc(db, COLLECTIONS.classes, id));
    if (!snapshot.exists()) {
      return null;
    }
    return { id: snapshot.id, ...(snapshot.data() as Omit<ClassDoc, 'id'>) };
  });
}

export async function getAllClasses(): Promise<ClassDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.classes));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<ClassDoc, 'id'>),
    }));
  });
}

export async function createSchedule(
  input: ScheduleInput,
): Promise<ScheduleDoc> {
  validateScheduleInput(input);
  return runFirestore(async () => {
    const classDoc = await getClassById(input.classId);
    if (!classDoc || classDoc.courseId !== input.courseId
      || classDoc.assistantUid !== auth.currentUser?.uid
      || !classDoc.semesterParity) {
      throw new Error('Pilih kelas yang berada di bawah tanggung jawab akun ini.');
    }
    const payload: ScheduleInput = {
      ...input,
      semesterParity: classDoc.semesterParity,
      assistantUid: classDoc.assistantUid,
    };
    const reference = await addDoc(collection(db, COLLECTIONS.schedules), payload);
    return { id: reference.id, ...payload };
  });
}

export async function updateSchedule(
  id: string,
  input: ScheduleInput,
): Promise<ScheduleDoc> {
  validateScheduleInput(input);
  return runFirestore(async () => {
    const classDoc = await getClassById(input.classId);
    if (!classDoc || classDoc.courseId !== input.courseId
      || classDoc.assistantUid !== auth.currentUser?.uid
      || !classDoc.semesterParity) {
      throw new Error('Pilih kelas yang berada di bawah tanggung jawab akun ini.');
    }
    const payload: ScheduleInput = {
      ...input,
      semesterParity: classDoc.semesterParity,
      assistantUid: classDoc.assistantUid,
    };
    await updateDoc(doc(db, COLLECTIONS.schedules, id), payload);
    return { id, ...payload };
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  return runFirestore(async () => {
    await deleteDoc(doc(db, COLLECTIONS.schedules, id));
  });
}

export async function getScheduleById(
  id: string,
): Promise<ScheduleDoc | null> {
  return runFirestore(async () => {
    const snapshot = await getDoc(doc(db, COLLECTIONS.schedules, id));
    if (!snapshot.exists()) {
      return null;
    }
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<ScheduleDoc, 'id'>),
    };
  });
}

export async function getAllSchedules(): Promise<ScheduleDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.schedules));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<ScheduleDoc, 'id'>),
    }));
  });
}

export async function createSession(input: SessionInput): Promise<SessionDoc> {
  validateSessionInput(input);
  const lecturer = resolveLecturer(input.lecturerId, input.lecturer);
  const classDoc = await resolveSessionClass(input.classId, input.courseId);
  if (classDoc.semesterParity !== 'ganjil' && classDoc.semesterParity !== 'genap') {
    throw new Error('Semester kelas belum dikonfigurasi.');
  }
  const payload: Omit<SessionDoc, 'id'> = {
    classId: classDoc.id,
    courseId: classDoc.courseId,
    practicumName: input.practicumName,
    className: classDoc.className,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status,
    lecturerId: input.lecturerId,
    lecturer,
    semester: classDoc.semester,
    semesterParity: classDoc.semesterParity,
    assistantUid: classDoc.assistantUid,
  };

  return runFirestore(async () => {
    const reference = await addDoc(collection(db, COLLECTIONS.sessions), {
      ...payload,
      startsAt: isoToFirestoreDate(payload.startsAt),
      endsAt: isoToFirestoreDate(payload.endsAt),
    });
    return { id: reference.id, ...payload };
  });
}

export async function updateSession(
  id: string,
  input: SessionInput,
): Promise<SessionDoc> {
  validateSessionInput(input);
  const lecturer = resolveLecturer(input.lecturerId, input.lecturer);
  const classDoc = await resolveSessionClass(input.classId, input.courseId);
  if (classDoc.semesterParity !== 'ganjil' && classDoc.semesterParity !== 'genap') {
    throw new Error('Semester kelas belum dikonfigurasi.');
  }
  const payload: Omit<SessionDoc, 'id'> = {
    classId: classDoc.id,
    courseId: classDoc.courseId,
    practicumName: input.practicumName,
    className: classDoc.className,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status,
    lecturerId: input.lecturerId,
    lecturer,
    semester: classDoc.semester,
    semesterParity: classDoc.semesterParity,
    assistantUid: classDoc.assistantUid,
  };

  return runFirestore(async () => {
    await updateDoc(doc(db, COLLECTIONS.sessions, id), {
      ...payload,
      startsAt: isoToFirestoreDate(payload.startsAt),
      endsAt: isoToFirestoreDate(payload.endsAt),
    });
    return { id, ...payload };
  });
}

export async function getSessionById(id: string): Promise<SessionDoc | null> {
  return runFirestore(async () => {
    const snapshot = await getDoc(doc(db, COLLECTIONS.sessions, id));
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data() as Omit<SessionDoc, 'id'>;
    return {
      ...data,
      id: snapshot.id,
      startsAt: firestoreDateToIso(data.startsAt),
      endsAt: firestoreDateToIso(data.endsAt),
    };
  });
}

export async function getAllSessions(): Promise<SessionDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.sessions));
    return snapshot.docs.map((document) => {
      const data = document.data() as Omit<SessionDoc, 'id'>;
      return {
        ...data,
        id: document.id,
        startsAt: firestoreDateToIso(data.startsAt),
        endsAt: firestoreDateToIso(data.endsAt),
      };
    });
  });
}

export async function seedInitialSessions(): Promise<number> {
  throw new Error(
    'Seed sesi demo dinonaktifkan. Data kelas dan sesi resmi harus disiapkan administrator dengan metadata owner, semester, parity, dan courseCatalog yang tervalidasi.',
  );
}
