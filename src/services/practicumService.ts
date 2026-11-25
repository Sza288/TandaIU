import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

import { ENROLLMENTS_COLLECTION } from "./enrollmentService";
import { getLaboratoryById } from "./laboratoryService";
import { courses } from "../data/courses";
import { dosen } from "../data/dosen";
import type { SessionStatus } from "../types";
import { firestoreDateToIso, isoToFirestoreDate } from "../utils/firestoreDate";
import {
  COLLECTIONS,
  type ClassDoc,
  type ClassInput,
  type ClockTime,
  type LaboratoryDoc,
  type DayOfWeek,
  type LecturerId,
  type ScheduleDoc,
  type ScheduleInput,
  type SessionDoc,
  type SessionInput,
} from "../types/praktikum";

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const CLOCK_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const SESSION_STATUSES: SessionStatus[] = ["terjadwal", "dibuka", "ditutup"];

const SESSION_CHILD_COLLECTIONS = [
  'attendances',
  'permits',
  'reviews',
] as const;

async function deleteSessionChildren(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;

  const snapshots = await Promise.all(
    sessionIds.flatMap((sessionId) =>
      SESSION_CHILD_COLLECTIONS.map((collectionName) =>
        getDocs(query(
          collection(db, collectionName),
          where('sessionId', '==', sessionId),
        )))),
  );

  for (const reference of snapshots.flatMap((snapshot) =>
    snapshot.docs.map((document) => document.ref))) {
    await deleteDoc(reference);
  }
  for (const sessionId of sessionIds) {
    await deleteDoc(doc(db, 'attendanceQrTokens', sessionId));
  }
}

function requireNonEmpty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
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
  const [hours, minutes] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function validateClassInput(input: ClassInput): void {
  requireNonEmpty(input.courseId, "Mata kuliah");
  requireNonEmpty(input.className, "Nama kelas");
  requireNonEmpty(input.createdAt, "Tanggal dibuat");
  if (Number.isNaN(Date.parse(input.createdAt))) {
    throw new Error("Tanggal dibuat harus berupa tanggal yang valid.");
  }
}

export function validateScheduleInput(input: ScheduleInput): void {
  requireNonEmpty(input.classId, "Kelas");
  requireNonEmpty(input.courseId, "Mata kuliah");
  requireNonEmpty(input.laboratoryId, "Laboratorium");
  if (input.room !== undefined) {
    requireNonEmpty(input.room, "Ruangan");
  }

  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 0 ||
    input.dayOfWeek > 6
  ) {
    throw new Error("Hari harus berupa angka 0 sampai 6.");
  }

  if (input.jumlahPertemuan !== undefined) {
    if (!Number.isInteger(input.jumlahPertemuan)) {
      throw new Error("Jumlah pertemuan harus berupa angka bulat.");
    }
    if (input.jumlahPertemuan < 1 || input.jumlahPertemuan > 20) {
      throw new Error("Jumlah pertemuan harus berada antara 1 sampai 20.");
    }
  }

  const startMinutes = parseClockTime(input.startTime, "Waktu mulai");
  const endMinutes = parseClockTime(input.endTime, "Waktu selesai");
  if (endMinutes <= startMinutes) {
    throw new Error("Waktu selesai harus setelah waktu mulai.");
  }
}

export function validateSessionInput(input: SessionInput): void {
  requireNonEmpty(input.classId, "Kelas");
  requireNonEmpty(input.courseId, "Mata kuliah");
  requireNonEmpty(input.practicumName, "Nama praktikum");
  requireNonEmpty(input.className, "Nama kelas");

  if (input.laboratoryId !== undefined && input.laboratoryId.trim() === "") {
    throw new Error("Laboratorium wajib dipilih.");
  }

  const startTimestamp = parseIsoDateTime(input.startsAt, "Waktu mulai");
  const endTimestamp = parseIsoDateTime(input.endsAt, "Waktu selesai");
  if (endTimestamp <= startTimestamp) {
    throw new Error("Waktu selesai harus setelah waktu mulai.");
  }

  if (!SESSION_STATUSES.includes(input.status)) {
    throw new Error("Status sesi tidak valid.");
  }
}

async function resolveLaboratory(
  laboratoryId?: string,
): Promise<string | null> {
  if (!laboratoryId) return null;
  requireNonEmpty(laboratoryId, "Laboratorium");
  const snapshot = await getDoc(
    doc(db, COLLECTIONS.laboratories, laboratoryId),
  );
  if (!snapshot.exists()) {
    throw new Error("Laboratorium tidak ditemukan.");
  }
  return laboratoryId;
}

function scheduleMatchFromStart(startsAt: string): {
  dayOfWeek: DayOfWeek;
  startTime: ClockTime;
} | null {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;

  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    dayOfWeek: wib.getUTCDay() as DayOfWeek,
    startTime: `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}` as ClockTime,
  };
}

async function resolveScheduleIdForSession(
  input: SessionInput,
  classDoc: ClassDoc,
): Promise<string | undefined> {
  if (input.scheduleId) return input.scheduleId;

  const match = scheduleMatchFromStart(input.startsAt);
  if (!match) return undefined;

  const schedules = await getAllSchedules();
  return schedules.find((schedule) =>
    schedule.classId === classDoc.id
    && schedule.semesterParity === classDoc.semesterParity
    && schedule.dayOfWeek === match.dayOfWeek
    && schedule.startTime === match.startTime)?.id;
}

function resolveLecturer(lecturerId: LecturerId, lecturer: string): string {
  const selected = dosen.find((item) => item.id === lecturerId);
  if (!selected) {
    throw new Error("Dosen tidak ditemukan.");
  }
  requireNonEmpty(lecturer, "Nama dosen");
  if (lecturer.trim() !== selected.name) {
    throw new Error("Nama dosen harus sesuai dengan dosen yang dipilih.");
  }
  return selected.name;
}

async function getClassForSession(classId: string): Promise<ClassDoc | null> {
  const user = auth.currentUser;
  if (!user) throw new Error('Akun Asprak tidak valid.');
  const token = await user.getIdTokenResult();
  const parity = token.claims.assistantSemesterParity;
  if (parity !== 'ganjil' && parity !== 'genap') {
    throw new Error('Penugasan semester akun Asprak belum dikonfigurasi.');
  }

  return runFirestore(async () => {
    const snapshot = await getDocs(query(
      collection(db, COLLECTIONS.classes),
      where('assistantUid', '==', user.uid),
      where('semesterParity', '==', parity),
      where(documentId(), '==', classId),
    ));
    const classSnapshot = snapshot.docs[0];
    return classSnapshot
      ? { id: classSnapshot.id, ...(classSnapshot.data() as Omit<ClassDoc, 'id'>) }
      : null;
  });
}

async function resolveSessionClass(
  classId: string,
  courseId: string,
): Promise<ClassDoc> {
  const selected = await getClassForSession(classId);
  if (!selected) {
    throw new Error("Kelas tidak ditemukan.");
  }
  if (selected.courseId !== courseId) {
    throw new Error("Kelas tidak sesuai dengan mata kuliah yang dipilih.");
  }
  const course = courses.find((item) => item.id === courseId);
  if (!course || course.semester !== selected.semester) {
    throw new Error("Semester kelas tidak sesuai dengan data mata kuliah.");
  }
  const currentUid = auth.currentUser?.uid;
  if (
    !currentUid ||
    selected.assistantUid !== currentUid ||
    !selected.semester
  ) {
    throw new Error(
      "Penanggung jawab atau semester kelas belum dikonfigurasi.",
    );
  }
  return selected;
}

async function buildOwnedClassInput(input: ClassInput): Promise<ClassInput> {
  const user = auth.currentUser;
  const course = courses.find((item) => item.id === input.courseId);
  if (!user || !course)
    throw new Error("Akun Asprak atau mata kuliah tidak valid.");
  const token = await user.getIdTokenResult();
  const parity = token.claims.assistantSemesterParity;
  if (
    (course.semester % 2 === 1 && parity !== "ganjil") ||
    (course.semester % 2 === 0 && parity !== "genap")
  ) {
    throw new Error(
      "Mata kuliah berada di luar semester tanggung jawab akun ini.",
    );
  }
  return {
    ...input,
    semester: course.semester,
    semesterParity: course.semester % 2 === 1 ? "ganjil" : "genap",
    assistantUid: user.uid,
  };
}

type FirestoreErrorLike = {
  code?: unknown;
};

function mapFirestoreError(error: unknown): Error {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as FirestoreErrorLike).code)
      : "";

  if (!code && error instanceof Error) {
    return error;
  }
  if (code.includes("permission-denied")) {
    return new Error("Anda tidak memiliki izin untuk melakukan aksi ini");
  }
  if (code.includes("unavailable")) {
    return new Error("Koneksi bermasalah, coba lagi");
  }
  return new Error(
    "Terjadi kesalahan saat menghubungi server. Silakan coba lagi.",
  );
}

async function withStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const detail = error instanceof Error && error.message.trim()
      ? error.message
      : 'akses ditolak';
    throw new Error(`${stage}: ${detail}`);
  }
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && String((error as FirestoreErrorLike).code).includes('permission-denied');
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
    const reference = await addDoc(
      collection(db, COLLECTIONS.classes),
      ownedInput,
    );
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
    if (
      !current ||
      current.assistantUid !== auth.currentUser?.uid ||
      current.semester !== ownedInput.semester
    ) {
      throw new Error(
        "Kelas tidak ditemukan atau berada di luar kewenangan akun ini.",
      );
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
    return { id: snapshot.id, ...(snapshot.data() as Omit<ClassDoc, "id">) };
  });
}

export async function getAllClasses(): Promise<ClassDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.classes));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<ClassDoc, "id">),
    }));
  });
}

export async function createSchedule(
  input: ScheduleInput,
): Promise<ScheduleDoc> {
  validateScheduleInput(input);
  return runFirestore(async () => {
    const classDoc = await getClassById(input.classId);
    if (
      !classDoc ||
      classDoc.courseId !== input.courseId ||
      classDoc.assistantUid !== auth.currentUser?.uid ||
      !classDoc.semesterParity
    ) {
      throw new Error(
        "Pilih kelas yang berada di bawah tanggung jawab akun ini.",
      );
    }
    const laboratoryId = await resolveLaboratory(input.laboratoryId);
    if (!laboratoryId) {
      throw new Error('Laboratorium tidak ditemukan.');
    }
    const payload: ScheduleInput = {
      ...input,
      laboratoryId,
      semesterParity: classDoc.semesterParity,
      assistantUid: classDoc.assistantUid,
    };
    const reference = await addDoc(
      collection(db, COLLECTIONS.schedules),
      payload,
    );
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
    if (
      !classDoc ||
      classDoc.courseId !== input.courseId ||
      classDoc.assistantUid !== auth.currentUser?.uid ||
      !classDoc.semesterParity
    ) {
      throw new Error(
        "Pilih kelas yang berada di bawah tanggung jawab akun ini.",
      );
    }
    const laboratoryId = await resolveLaboratory(input.laboratoryId);
    if (!laboratoryId) {
      throw new Error('Laboratorium tidak ditemukan.');
    }
    const payload: ScheduleInput = {
      ...input,
      laboratoryId,
      semesterParity: classDoc.semesterParity,
      assistantUid: classDoc.assistantUid,
    };
    await updateDoc(doc(db, COLLECTIONS.schedules, id), payload);
    return { id, ...payload };
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  const schedule = await getScheduleById(id);
  if (!schedule) {
    throw new Error("Jadwal tidak ditemukan.");
  }
  if (!schedule.assistantUid || !schedule.semesterParity) {
    throw new Error("Jadwal belum memiliki penanggung jawab semester.");
  }
  const { assistantUid, semesterParity } = schedule;

  const sessions = await runFirestore(async () => {
    const snapshot = await getDocs(
      query(
        collection(db, COLLECTIONS.sessions),
        where("assistantUid", "==", assistantUid),
        where("semesterParity", "==", semesterParity),
        where("scheduleId", "==", id),
      ),
    );
    return snapshot.docs.map((document) => ({
      id: document.id,
      status: (document.data() as SessionDoc).status,
    }));
  });

  if (sessions.some((session) => session.status === "dibuka")) {
    throw new Error(
      "Masih ada sesi yang sedang dibuka pada jadwal ini. Tutup sesi tersebut terlebih dahulu.",
    );
  }

  return runFirestore(async () => {
    const sessionsToDelete = sessions
      .filter((session) => session.status === "terjadwal")
      .map((session) => session.id);
    await deleteSessionChildren(sessionsToDelete);
    for (const session of sessions) {
      if (session.status === "terjadwal") {
        await deleteDoc(doc(db, COLLECTIONS.sessions, session.id));
        continue;
      }
      await updateDoc(doc(db, COLLECTIONS.sessions, session.id), {
        scheduleId: deleteField(),
      });
    }
    await deleteDoc(doc(db, COLLECTIONS.schedules, id));
  });
}

export async function deleteSession(id: string): Promise<void> {
  const current = await getSessionById(id);
  if (!current) {
    throw new Error("Sesi tidak ditemukan.");
  }
  if (current.status !== "terjadwal") {
    throw new Error(
      current.status === "dibuka"
        ? "Sesi yang sedang dibuka tidak dapat dihapus. Tutup sesi terlebih dahulu."
        : "Sesi yang sudah ditutup disimpan sebagai riwayat dan tidak dapat dihapus.",
    );
  }
  await runFirestore(async () => {
    await deleteSessionChildren([id]);
    await deleteDoc(doc(db, COLLECTIONS.sessions, id));
  });
}

export async function deleteClass(id: string): Promise<void> {
  const classDoc = await getClassById(id);
  if (!classDoc) {
    throw new Error("Kelas tidak ditemukan.");
  }
  if (!classDoc.assistantUid || !classDoc.semesterParity) {
    throw new Error("Kelas belum memiliki penanggung jawab semester.");
  }
  const { assistantUid, semesterParity } = classDoc;

  const [sessions, scheduleIds, enrollmentIds] = await runFirestore(async () => {
    const [sessionSnapshot, scheduleSnapshot, enrollmentSnapshot] =
      await Promise.all([
        getDocs(
          query(
            collection(db, COLLECTIONS.sessions),
            where("assistantUid", "==", assistantUid),
            where("semesterParity", "==", semesterParity),
            where("classId", "==", id),
          ),
        ),
        getDocs(
          query(
            collection(db, COLLECTIONS.schedules),
            where("assistantUid", "==", assistantUid),
            where("semesterParity", "==", semesterParity),
            where("classId", "==", id),
          ),
        ),
        getDocs(
          query(
            collection(db, ENROLLMENTS_COLLECTION),
            where("classId", "==", id),
          ),
        ),
      ]);

    return [
      sessionSnapshot.docs.map((document) => ({
        id: document.id,
        status: (document.data() as SessionDoc).status,
      })),
      scheduleSnapshot.docs.map((document) => document.id),
      enrollmentSnapshot.docs.map((document) => document.id),
    ] as const;
  });

  if (scheduleIds.length > 0) {
    throw new Error(
      "Kelas masih memiliki jadwal. Hapus jadwal tersebut terlebih dahulu.",
    );
  }
  if (sessions.some((session) => session.status === "dibuka")) {
    throw new Error(
      "Kelas masih memiliki sesi yang sedang dibuka. Tutup sesi tersebut terlebih dahulu.",
    );
  }
  if (sessions.some((session) => session.status === "terjadwal")) {
    throw new Error(
      "Kelas masih memiliki sesi terjadwal. Hapus sesi tersebut terlebih dahulu.",
    );
  }

  await runFirestore(async () => {
    await deleteSessionChildren(sessions.map((session) => session.id));
    for (const session of sessions) {
      await deleteDoc(doc(db, COLLECTIONS.sessions, session.id));
    }
    for (const enrollmentId of enrollmentIds) {
      await deleteDoc(doc(db, ENROLLMENTS_COLLECTION, enrollmentId));
    }
    await deleteDoc(doc(db, COLLECTIONS.classes, id));
  });
}

export type GenerateSessionsInput = {
  scheduleId: string;
  dates: string[];
  lecturerId: LecturerId;
  lecturer: string;
  laboratoryId: string;
  startTime: ClockTime;
  endTime: ClockTime;
};

/**
 * Membuat satu sesi untuk setiap tanggal pertemuan yang dipilih. Tidak ada
 * penghapusan atau penimpaan: tanggal yang sudah punya sesi dilewati.
 */
export async function generateSessionsFromSchedule(
  input: GenerateSessionsInput,
): Promise<{ created: string[]; skipped: string[]; failed: string[] }> {
  if (input.dates.length === 0) {
    throw new Error("Pilih minimal satu tanggal pertemuan.");
  }
  requireNonEmpty(input.laboratoryId, "Laboratorium");

  const schedule = await withStage('Gagal memuat jadwal', () => getScheduleById(input.scheduleId));
  if (!schedule) {
    throw new Error("Jadwal tidak ditemukan.");
  }
  const classDoc = await withStage('Gagal memuat kelas', () =>
    resolveSessionClass(schedule.classId, schedule.courseId));
  const semesterParity = classDoc.semesterParity;
  if (semesterParity !== 'ganjil' && semesterParity !== 'genap') {
    throw new Error('Semester kelas belum dikonfigurasi.');
  }

  const lecturer = resolveLecturer(input.lecturerId, input.lecturer);
  const laboratoryId = await withStage('Gagal memuat laboratorium', () =>
    resolveLaboratory(input.laboratoryId));
  if (!laboratoryId) {
    throw new Error("Laboratorium tidak ditemukan.");
  }

  const existing = await withStage('Gagal memuat sesi', () =>
    getSessionsForClass(schedule.classId, semesterParity));
  const taken = new Set(
    existing.map((session) => session.startsAt.slice(0, 10)),
  );

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const date of input.dates) {
    if (taken.has(date)) {
      skipped.push(date);
      continue;
    }
    const startsAt = combineDateAndTime(date, input.startTime);
    const endsAt = combineDateAndTime(date, input.endTime);
    const payload: Omit<SessionDoc, "id"> = {
      classId: classDoc.id,
      courseId: classDoc.courseId,
      practicumName:
        schedule.courseId === classDoc.courseId
          ? (courses.find((course) => course.id === classDoc.courseId)?.name ??
            "")
          : "",
      className: classDoc.className,
      startsAt,
      endsAt,
      status: "terjadwal",
      lecturerId: input.lecturerId,
      lecturer,
      semester: classDoc.semester,
      semesterParity: classDoc.semesterParity,
      assistantUid: classDoc.assistantUid,
      laboratoryId,
      scheduleId: schedule.id,
    };
    if (!payload.practicumName) {
      throw new Error("Nama praktikum tidak ditemukan untuk kelas ini.");
    }

    try {
      const reference = await addDoc(collection(db, COLLECTIONS.sessions), {
        ...payload,
        startsAt: isoToFirestoreDate(payload.startsAt),
        endsAt: isoToFirestoreDate(payload.endsAt),
      });
      created.push(reference.id);
    } catch (error) {
      if (isPermissionDenied(error)) {
        throw new Error(
          'Gagal menyimpan sesi: Anda tidak memiliki izin untuk melakukan aksi ini',
        );
      }
      failed.push(date);
    }
  }

  return { created, skipped, failed };
}

function combineDateAndTime(date: string, time: ClockTime): string {
  const [hours = "0", minutes = "0"] = time.split(":");
  const iso = `${date}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00+07:00`;
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    throw new Error("Tanggal atau waktu pertemuan tidak valid.");
  }
  return new Date(timestamp).toISOString();
}

export async function getScheduleById(id: string): Promise<ScheduleDoc | null> {
  return runFirestore(async () => {
    const snapshot = await getDoc(doc(db, COLLECTIONS.schedules, id));
    if (!snapshot.exists()) {
      return null;
    }
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<ScheduleDoc, "id">),
    };
  });
}

export async function getAllSchedules(): Promise<ScheduleDoc[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Akun Asprak tidak valid.');
  const token = await user.getIdTokenResult();
  const parity = token.claims.assistantSemesterParity;
  if (parity !== 'ganjil' && parity !== 'genap') {
    throw new Error('Penugasan semester akun Asprak belum dikonfigurasi.');
  }
  return runFirestore(async () => {
    const snapshot = await getDocs(query(
      collection(db, COLLECTIONS.schedules),
      where('assistantUid', '==', user.uid),
      where('semesterParity', '==', parity),
    ));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Omit<ScheduleDoc, "id">),
    }));
  });
}

export async function createSession(input: SessionInput): Promise<SessionDoc> {
  validateSessionInput(input);
  const lecturer = resolveLecturer(input.lecturerId, input.lecturer);
  const classDoc = await resolveSessionClass(input.classId, input.courseId);
  if (
    classDoc.semesterParity !== "ganjil" &&
    classDoc.semesterParity !== "genap"
  ) {
    throw new Error("Semester kelas belum dikonfigurasi.");
  }
  if (!input.laboratoryId) {
    throw new Error("Laboratorium wajib dipilih.");
  }
  const laboratoryId = await resolveLaboratory(input.laboratoryId);
  const scheduleId = await resolveScheduleIdForSession(input, classDoc);
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
    ...(laboratoryId ? { laboratoryId } : {}),
    ...(scheduleId ? { scheduleId } : {}),
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

/**
 * Jadwal yang sudah dihapus tidak bisa dibaca lagi (rules menolak `get` untuk
 * dokumen yang tidak ada), jadi kegagalan baca diperlakukan sebagai referensi
 * yang sudah tidak valid.
 */
async function sessionScheduleStillExists(scheduleId?: string): Promise<boolean> {
  if (!scheduleId) return false;
  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.schedules, scheduleId));
    return snapshot.exists();
  } catch {
    return false;
  }
}

export async function updateSession(
  id: string,
  input: SessionInput,
): Promise<SessionDoc> {
  validateSessionInput(input);
  const current = await getSessionById(id);
  if (!current) {
    throw new Error("Sesi tidak ditemukan.");
  }
  if (current.status !== "terjadwal") {
    throw new Error(
      current.status === "dibuka"
        ? "Sesi yang sedang dibuka tidak dapat diubah. Tutup sesi terlebih dahulu."
        : "Sesi yang sudah ditutup tidak dapat diubah.",
    );
  }
  const lecturer = resolveLecturer(input.lecturerId, input.lecturer);
  const classDoc = await resolveSessionClass(input.classId, input.courseId);
  if (
    classDoc.semesterParity !== "ganjil" &&
    classDoc.semesterParity !== "genap"
  ) {
    throw new Error("Semester kelas belum dikonfigurasi.");
  }
  const laboratoryId = await resolveLaboratory(input.laboratoryId);
  const currentLaboratoryExists = current.laboratoryId
    ? Boolean(await getLaboratoryById(current.laboratoryId))
    : false;
  const keptLaboratoryId =
    laboratoryId ?? (currentLaboratoryExists ? current.laboratoryId : undefined);
  const keptScheduleId =
    (await resolveScheduleIdForSession(input, classDoc))
    ?? ((await sessionScheduleStillExists(current.scheduleId))
      ? current.scheduleId
      : undefined);

  const payload: Omit<SessionDoc, "id"> = {
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
    ...(keptLaboratoryId ? { laboratoryId: keptLaboratoryId } : {}),
    ...(keptScheduleId ? { scheduleId: keptScheduleId } : {}),
  };

  return runFirestore(async () => {
    const updatePayload: Record<string, unknown> = {
      ...payload,
      startsAt: isoToFirestoreDate(payload.startsAt),
      endsAt: isoToFirestoreDate(payload.endsAt),
    };
    if (!keptLaboratoryId) updatePayload.laboratoryId = deleteField();
    if (!keptScheduleId) updatePayload.scheduleId = deleteField();
    await updateDoc(doc(db, COLLECTIONS.sessions, id), updatePayload);
    return { id, ...payload };
  });
}

export async function getSessionById(id: string): Promise<SessionDoc | null> {
  return runFirestore(async () => {
    const snapshot = await getDoc(doc(db, COLLECTIONS.sessions, id));
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data() as Omit<SessionDoc, "id">;
    return {
      ...data,
      id: snapshot.id,
      startsAt: firestoreDateToIso(data.startsAt),
      endsAt: firestoreDateToIso(data.endsAt),
    };
  });
}

/**
 * Sesi milik satu kelas, dibaca lewat query yang memakai filter sehingga
 * Firestore Rules dapat mengevaluasinya (list tanpa filter selalu ditolak).
 */
export async function getSessionsForClass(
  classId: string,
  semesterParity: "ganjil" | "genap",
): Promise<SessionDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(
      query(
        collection(db, COLLECTIONS.sessions),
        where("assistantUid", "==", auth.currentUser?.uid ?? ""),
        where("semesterParity", "==", semesterParity),
        where("classId", "==", classId),
      ),
    );
    return snapshot.docs.map((document) => {
      const data = document.data() as Omit<SessionDoc, "id">;
      return {
        ...data,
        id: document.id,
        startsAt: firestoreDateToIso(data.startsAt),
        endsAt: firestoreDateToIso(data.endsAt),
      };
    });
  });
}

export async function getAllSessions(): Promise<SessionDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.sessions));
    return snapshot.docs.map((document) => {
      const data = document.data() as Omit<SessionDoc, "id">;
      return {
        ...data,
        id: document.id,
        startsAt: firestoreDateToIso(data.startsAt),
        endsAt: firestoreDateToIso(data.endsAt),
      };
    });
  });
}

function mapLaboratory(
  id: string,
  data: Record<string, unknown>,
): LaboratoryDoc {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const lantai =
    typeof data.lantai === "number" && Number.isFinite(data.lantai)
      ? data.lantai
      : typeof data.lantai === "string" &&
          data.lantai.trim() !== "" &&
          Number.isFinite(Number(data.lantai))
        ? Number(data.lantai)
        : null;

  const { latitude, longitude, radius } = data;
  const createdAt = firestoreDateToIso(data.createdAt);
  const updatedAt = firestoreDateToIso(data.updatedAt);

  if (
    !name ||
    lantai === null ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof radius !== "number" ||
    !Number.isFinite(radius) ||
    radius < 1 ||
    radius > 500 ||
    !createdAt ||
    Number.isNaN(Date.parse(createdAt)) ||
    !updatedAt ||
    Number.isNaN(Date.parse(updatedAt))
  ) {
    throw new Error(`Data laboratorium ${id} tidak valid.`);
  }

  return {
    id,
    name,
    latitude,
    longitude,
    radius,
    lantai,
    isActive: data.isActive !== false,
    createdAt,
    updatedAt,
  };
}

export async function getAllLaboratories(): Promise<LaboratoryDoc[]> {
  return runFirestore(async () => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.laboratories));
    return snapshot.docs.map((document) =>
      mapLaboratory(document.id, document.data()),
    );
  });
}

export async function seedInitialSessions(): Promise<number> {
  throw new Error(
    "Seed sesi demo dinonaktifkan. Data kelas dan sesi resmi harus disiapkan administrator dengan metadata owner, semester, parity, dan courseCatalog yang tervalidasi.",
  );
}
