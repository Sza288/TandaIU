import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { dosen } from '../data/dosen';
import { initialSessions } from '../data/sessions';
import { db } from '../lib/firebase';
import type { SessionStatus } from '../types';
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
  requireNonEmpty(input.courseId, 'Mata kuliah');
  requireNonEmpty(input.practicumName, 'Nama praktikum');
  requireNonEmpty(input.className, 'Kelas');

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
  return runFirestore(async () => {
    const reference = await addDoc(collection(db, COLLECTIONS.classes), input);
    return { id: reference.id, ...input };
  });
}

export async function updateClass(
  id: string,
  input: ClassInput,
): Promise<ClassDoc> {
  validateClassInput(input);
  return runFirestore(async () => {
    await updateDoc(doc(db, COLLECTIONS.classes, id), input);
    return { id, ...input };
  });
}

export async function deleteClass(id: string): Promise<void> {
  return runFirestore(async () => {
    await deleteDoc(doc(db, COLLECTIONS.classes, id));
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
    const reference = await addDoc(collection(db, COLLECTIONS.schedules), input);
    return { id: reference.id, ...input };
  });
}

export async function updateSchedule(
  id: string,
  input: ScheduleInput,
): Promise<ScheduleDoc> {
  validateScheduleInput(input);
  return runFirestore(async () => {
    await updateDoc(doc(db, COLLECTIONS.schedules, id), input);
    return { id, ...input };
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
  const payload: Omit<SessionDoc, 'id'> = {
    courseId: input.courseId,
    practicumName: input.practicumName,
    className: input.className,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status,
    lecturerId: input.lecturerId,
    lecturer,
  };

  return runFirestore(async () => {
    const reference = await addDoc(collection(db, COLLECTIONS.sessions), payload);
    return { id: reference.id, ...payload };
  });
}

export async function updateSession(
  id: string,
  input: SessionInput,
): Promise<SessionDoc> {
  validateSessionInput(input);
  const lecturer = resolveLecturer(input.lecturerId, input.lecturer);
  const payload: Omit<SessionDoc, 'id'> = {
    courseId: input.courseId,
    practicumName: input.practicumName,
    className: input.className,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status,
    lecturerId: input.lecturerId,
    lecturer,
  };

  return runFirestore(async () => {
    await updateDoc(doc(db, COLLECTIONS.sessions, id), payload);
    return { id, ...payload };
  });
}

export async function deleteSession(id: string): Promise<void> {
  return runFirestore(async () => {
    await deleteDoc(doc(db, COLLECTIONS.sessions, id));
  });
}

export async function getSessionById(id: string): Promise<SessionDoc | null> {
  return runFirestore(async () => {
    const snapshot = await getDoc(doc(db, COLLECTIONS.sessions, id));
    if (!snapshot.exists()) {
      return null;
    }
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<SessionDoc, 'id'>),
    };
  });
}

export async function getAllSessions(): Promise<SessionDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.sessions));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<SessionDoc, 'id'>),
    }));
  });
}

export async function seedInitialSessions(): Promise<number> {
  return runFirestore(async () => {
    const existing = await getDocs(collection(db, COLLECTIONS.sessions));
    if (!existing.empty) {
      return 0;
    }

    for (const session of initialSessions) {
      const { id, ...payload } = session;
      await setDoc(doc(db, COLLECTIONS.sessions, id), payload);
    }

    return initialSessions.length;
  });
}
