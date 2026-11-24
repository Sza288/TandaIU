import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { initialAttendances } from '../data/attendances';
import { initialSessions } from '../data/sessions';
import { praktikans } from '../data/praktikans';
import type { CurrentUser } from '../lib/currentSession';
import type { Attendance, MutationResult, PracticumSession } from '../types';
import { firestoreDateToIso, isoToFirestoreDate } from '../utils/firestoreDate';
import { httpsCallable } from 'firebase/functions';

export type AttendanceRecord = Attendance & {
  id: string;
  praktikanName: string;
};

export type AttendanceListener = (records: AttendanceRecord[]) => void;
export type SessionListener = (session: PracticumSession | null) => void;
export type SessionsListener = (sessions: PracticumSession[]) => void;
export type ListenerErrorHandler = (message: string) => void;
export type AttendanceUnsubscribe = Unsubscribe;
export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

type ServiceMode = 'firestore' | 'mock';

export type AttendanceService = {
  mode: ServiceMode;
  openSession: (sessionId: string) => Promise<MutationResult>;
  closeSession: (sessionId: string) => Promise<MutationResult>;
  checkIn: (
    sessionId: string,
    user?: CurrentUser | null,
    location?: AttendanceLocation | null,
  ) => Promise<MutationResult>;
  subscribeToAttendance: (
    sessionId: string,
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
    praktikanId?: string,
  ) => AttendanceUnsubscribe;
  subscribeToSession: (
    sessionId: string,
    onData: SessionListener,
    onError?: ListenerErrorHandler,
  ) => AttendanceUnsubscribe;
  subscribeToSessions: (
    onData: SessionsListener,
    onError?: ListenerErrorHandler,
  ) => AttendanceUnsubscribe;
  subscribeToPraktikanAttendance: (
    praktikanId: string,
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
  ) => AttendanceUnsubscribe;
  subscribeToAllAttendance: (
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
  ) => AttendanceUnsubscribe;
};

export type AttendanceServiceOptions = {
  mode?: ServiceMode;
  database?: Firestore;
  getCurrentUser?: () => CurrentUser | null;
  now?: () => Date;
  sessions?: PracticumSession[];
  attendances?: Attendance[];
};

const GENERIC_MUTATION_ERROR =
  'Gagal menyimpan perubahan. Periksa koneksi dan konfigurasi Firebase.';
const GENERIC_LISTENER_ERROR =
  'Gagal memuat data presensi. Periksa koneksi dan konfigurasi Firebase.';
const FIREBASE_NOT_CONFIGURED_MESSAGE =
  'Firebase belum dikonfigurasi. Isi variabel EXPO_PUBLIC_FIREBASE_* pada .env.';
const CALLABLE_DOMAIN_ERROR_MESSAGES: Record<string, string> = {
  SESSION_NOT_OPEN: 'Presensi tidak bisa dilakukan, karena jam di luar sesi praktikum.',
  SESSION_NOT_STARTED: 'Presensi belum dapat dilakukan karena sesi praktikum belum dimulai.',
  SESSION_ENDED: 'Presensi tidak bisa dilakukan karena waktu sesi praktikum telah berakhir.',
  SESSION_CLOSED: 'Presensi tidak bisa dilakukan karena sesi praktikum telah ditutup.',
  SESSION_TIME_INVALID: 'Presensi tidak bisa dilakukan karena waktu sesi praktikum tidak valid.',
  SESSION_NOT_FOUND: 'Sesi praktikum tidak ditemukan.',
  LABORATORY_NOT_FOUND: 'Data laboratorium sesi ini tidak ditemukan.',
  ATTENDANCE_NOT_FOUND: 'Data presensi tidak ditemukan.',
};

export function callableErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback;
  const callableError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const details = typeof callableError.details === 'object' && callableError.details !== null
    ? callableError.details as { reasonCode?: unknown }
    : null;
  if (typeof details?.reasonCode === 'string') {
    const domainMessage = CALLABLE_DOMAIN_ERROR_MESSAGES[details.reasonCode];
    if (domainMessage) return domainMessage;
  }
  const code = typeof callableError.code === 'string' ? callableError.code : '';
  if (code === 'functions/not-found'
    || (typeof callableError.message === 'string'
      && /not found.*404|404.*not found/i.test(callableError.message))) {
    return 'Layanan presensi tidak ditemukan pada backend yang terhubung. Periksa konfigurasi Firebase/Emulator lalu coba lagi.';
  }
  if (code === 'functions/unavailable') {
    return 'Layanan presensi sedang tidak tersedia. Periksa koneksi dan coba lagi.';
  }
  if (code === 'functions/internal' || code === 'functions/unknown') return fallback;
  if (code.startsWith('functions/')
    && ![
      'functions/already-exists',
      'functions/deadline-exceeded',
      'functions/failed-precondition',
      'functions/invalid-argument',
      'functions/permission-denied',
      'functions/unauthenticated',
    ].includes(code)) {
    return fallback;
  }
  if (!code.startsWith('functions/')) return fallback;
  return typeof callableError.message === 'string' && callableError.message.trim()
    ? callableError.message
    : fallback;
}

/**
 * Kontrak hasil mutasi presensi: setiap operasi selalu mengembalikan
 * `{ ok: true }` saat berhasil atau `{ ok: false, reason }` saat ditolak.
 * Layar wajib menampilkan `reason` apa adanya agar praktikan tahu sebabnya.
 *
 * Alasan kegagalan `checkIn` (urutan pemeriksaan):
 * 1. `ATTENDANCE_IDENTITY_INVALID_REASON` — tidak ada sesi Firebase Auth,
 *    identitas tidak cocok dengan akun aktif, `name` kosong, profil
 *    `users/{uid}` tidak ada/tidak cocok, role profil bukan `praktikan`,
 *    atau UID masih berupa ID demo `p1..p31` (mode Firestore).
 * 2. `"Hanya praktikan yang dapat melakukan presensi."` — role akun asisten.
 * 3. `"Sesi tidak ditemukan."` — `sessions/{sessionId}` tidak ada.
 * 4. `ATTENDANCE_SESSION_NOT_OPEN_REASON` — status sesi bukan `dibuka`.
 * 5. `ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON` — `sessions/{sessionId}.classId`
 *    kosong atau `enrollments/{classId}_{uid}` tidak ada/tidak cocok. Validasi
 *    ini berada di transaksi yang sama agar check-in tidak dapat melewati
 *    relasi enrollment.
 * 6. `ATTENDANCE_ALREADY_CHECKED_IN_REASON` — dokumen
 *    `attendances/{sessionId}_{uid}` sudah ada (SRS-11).
 * 7. Pesan Firestore generik / `permission-denied` bila transaksi gagal.
 *
 * Catatan cakupan: layar juga memakai `checkEnrollmentEligibility` untuk
 * menyembunyikan sesi yang tidak terdaftar, tetapi keputusan akhir tetap
 * dilakukan di transaksi Firestore. Enrollment kosong TIDAK boleh diartikan
 * "semua sesi".
 */
export const ATTENDANCE_IDENTITY_INVALID_REASON =
  'Identitas tidak valid. Masuk kembali dengan akun praktikan yang terdaftar.';
export const ATTENDANCE_SESSION_NOT_OPEN_REASON =
  'Presensi hanya tersedia saat sesi dibuka.';
export const ATTENDANCE_ALREADY_CHECKED_IN_REASON =
  'Kamu sudah melakukan presensi pada sesi ini.';
export const ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON =
  'Enrollment sesi ini belum terverifikasi, presensi tidak dapat dilakukan.';

/**
 * Cakupan sesi yang boleh dipresensi oleh satu praktikan. `verified` hanya
 * bernilai true bila ada minimal satu sesi hasil enrollment; kondisi kosong
 * berarti enrollment belum diketahui dan TIDAK boleh jatuh ke "semua sesi".
 */
export type AttendanceEnrollmentScope = {
  verified: boolean;
  sessionIds: readonly string[];
};

export function buildAttendanceEnrollmentScope(
  sessionIds: readonly string[],
): AttendanceEnrollmentScope {
  return { verified: sessionIds.length > 0, sessionIds: [...sessionIds] };
}

export function isSessionEnrolled(
  scope: AttendanceEnrollmentScope,
  sessionId: string,
): boolean {
  return scope.verified && scope.sessionIds.includes(sessionId);
}

/**
 * Hasil `{ ok, reason }` untuk pemeriksaan enrollment sebelum check-in.
 * Dipakai layar agar penolakan terjadi sebelum transaksi Firestore.
 */
export function checkEnrollmentEligibility(
  scope: AttendanceEnrollmentScope,
  sessionId: string,
): MutationResult {
  return isSessionEnrolled(scope, sessionId)
    ? { ok: true }
    : { ok: false, reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON };
}

/**
 * Firebase reads EXPO_PUBLIC_* at build time, so the variables must be
 * referenced directly (no dynamic process.env[name] lookup).
 */
export const isFirebaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
);

/**
 * A practikan can attend many sessions, therefore the document id is
 * deterministic per session+user. This is also the atomic duplicate guard:
 * a second create for the same pair targets the same document.
 */
export function getAttendanceDocId(sessionId: string, praktikanId: string): string {
  return `${sessionId}_${praktikanId}`;
}

const DEMO_PRACTIKAN = praktikans[0];

const MOCK_USER: CurrentUser = {
  uid: DEMO_PRACTIKAN.id,
  name: DEMO_PRACTIKAN.name,
  email: 'andi.pratama@students.undip.ac.id',
  role: 'praktikan',
  studentCode: DEMO_PRACTIKAN.studentCode,
};

/**
 * `src/lib/firebase.ts` eagerly calls `getAuth()`, which throws when the
 * environment variables are empty. The shared helper must therefore only be
 * loaded when Firebase is configured; otherwise the app would crash before
 * the mock-mode demo can start.
 *
 * In Firestore mode the identity must come from Firebase Auth. Returning
 * `null` here is deliberate: a missing session must fail the check-in with
 * "identitas tidak valid" instead of silently writing attendance for the
 * dummy `p1` account.
 */
export function getAttendanceUser(): CurrentUser | null {
  if (!isFirebaseConfigured) return MOCK_USER;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    const firebaseUser = firebase.auth.currentUser;
    if (!firebaseUser) return null;

    return {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName ?? '',
      email: firebaseUser.email ?? '',
      role: 'praktikan',
    };
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[attendanceService] Firebase Auth gagal dibaca.', error);
    }
    return null;
  }
}

const DUMMY_PRACTIKAN_ID = /^p\d+$/;

/** IDs `p1..p31` are local demo identities, never real Firebase Auth UIDs. */
export function isDummyPraktikanId(id: string): boolean {
  return DUMMY_PRACTIKAN_ID.test(id);
}

function getConfiguredDatabase(): Firestore | undefined {
  if (!isFirebaseConfigured) return undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    return firebase.db;
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[attendanceService] Firebase gagal diinisialisasi.', error);
    }
    return undefined;
  }
}

class AttendanceServiceError extends Error {}

type FirestoreTimestampValue = {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
};

function isFirestoreTimestamp(value: unknown): value is FirestoreTimestampValue {
  return typeof value === 'object'
    && value !== null
    && 'seconds' in value
    && typeof value.seconds === 'number'
    && 'nanoseconds' in value
    && typeof value.nanoseconds === 'number'
    && 'toDate' in value
    && typeof value.toDate === 'function';
}

function sessionTimestampForWrite(value: unknown): Date | FirestoreTimestampValue {
  if (isFirestoreTimestamp(value)) return value;
  const iso = firestoreDateToIso(value);
  if (!iso) throw new AttendanceServiceError('Waktu sesi tidak valid dan tidak dapat dinormalisasi.');
  return isoToFirestoreDate(iso);
}

/**
 * Jenis operasi memengaruhi pesan kegagalan. Sebelumnya semua operasi memakai
 * satu pesan yang menyebut koleksi `attendances`, sehingga kegagalan pada
 * `sessions` (buka/tutup sesi) menyesatkan pengguna.
 */
type MutationOperation = 'openSession' | 'closeSession' | 'checkIn';

const SESSION_PERMISSION_DENIED_REASON: Record<'openSession' | 'closeSession', string> = {
  openSession:
    'Akses ditolak. Hanya asisten yang dapat membuka sesi. Periksa Firestore Security Rules untuk koleksi sessions.',
  closeSession:
    'Akses ditolak. Hanya asisten yang dapat menutup sesi. Periksa Firestore Security Rules untuk koleksi sessions.',
};

function toMutationFailure(
  error: unknown,
  operation: MutationOperation = 'checkIn',
): MutationResult {
  if (error instanceof AttendanceServiceError) {
    return { ok: false, reason: error.message };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'permission-denied'
  ) {
    if (operation === 'checkIn') {
      return {
        ok: false,
        reason: 'Presensi ditolak. Pastikan sesi sedang dibuka, waktu sesi masih berlaku, dan enrollment kamu valid.',
      };
    }
    return { ok: false, reason: SESSION_PERMISSION_DENIED_REASON[operation] };
  }

  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('[attendanceService]', error);
  }
  return { ok: false, reason: GENERIC_MUTATION_ERROR };
}

export function describeListenerError(error: unknown): string {
  if (error instanceof AttendanceServiceError) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'permission-denied'
  ) {
    return 'Akses ditolak. Periksa Firestore Security Rules untuk koleksi attendances.';
  }
  return GENERIC_LISTENER_ERROR;
}

function mapAttendance(id: string, data: DocumentData): AttendanceRecord {
  const status =
    data.status === 'izin'
      ? 'izin'
      : data.status === 'dibatalkan'
        ? 'dibatalkan'
        : 'hadir';
  const excuseReason =
    data.excuseReason === 'sakit' || data.excuseReason === 'izin-lainnya'
      ? data.excuseReason
      : undefined;

  return {
    id,
    sessionId: String(data.sessionId ?? ''),
    praktikanId: String(data.praktikanId ?? ''),
    praktikanName: String(data.praktikanName ?? 'Praktikan'),
    attendedAt: firestoreDateToIso(data.attendedAt),
    status,
    attendanceMethod:
      data.attendanceMethod === 'qr' || data.attendanceMethod === 'location'
        ? data.attendanceMethod
        : undefined,
    excuseReason,
    latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
    longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
    distanceMeters: typeof data.distanceMeters === 'number' ? data.distanceMeters : undefined,
    accuracyMeters: typeof data.accuracyMeters === 'number' ? data.accuracyMeters : undefined,
    radiusMeters: typeof data.radiusMeters === 'number' ? data.radiusMeters : undefined,
    laboratoryId: typeof data.laboratoryId === 'string' ? data.laboratoryId : undefined,
    laboratoryName: typeof data.laboratoryName === 'string' ? data.laboratoryName : undefined,
    cancelledAt: data.cancelledAt ? firestoreDateToIso(data.cancelledAt) : undefined,
    cancelledBy: typeof data.cancelledBy === 'string' ? data.cancelledBy : undefined,
    cancelReason: typeof data.cancelReason === 'string' ? data.cancelReason : undefined,
  };
}

function mapSession(id: string, data: DocumentData): PracticumSession {
  const status =
    data.status === 'dibuka' || data.status === 'ditutup' ? data.status : 'terjadwal';

  return {
    id,
    courseId: String(data.courseId ?? ''),
    practicumName: String(data.practicumName ?? 'Praktikum'),
    className: String(data.className ?? ''),
    startsAt: firestoreDateToIso(data.startsAt),
    endsAt: firestoreDateToIso(data.endsAt),
    status,
    laboratoryId: typeof data.laboratoryId === 'string' ? data.laboratoryId : undefined,
    assistantUid: typeof data.assistantUid === 'string' ? data.assistantUid : undefined,
  };
}

function byAttendedAt(a: AttendanceRecord, b: AttendanceRecord): number {
  return a.attendedAt.localeCompare(b.attendedAt);
}

function seedAttendances(records: Attendance[]): AttendanceRecord[] {
  const nameById = new Map(praktikans.map((praktikan) => [praktikan.id, praktikan.name]));

  return records.map((record) => ({
    ...record,
    id: getAttendanceDocId(record.sessionId, record.praktikanId),
    praktikanName: nameById.get(record.praktikanId) ?? 'Praktikan',
    status: record.status ?? 'hadir',
  }));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Local demo backend. It is only used when the Firebase env variables are
 * empty so the attendance flow stays demonstrable before the Firebase project
 * credentials are available. The API and the validation rules are identical
 * to the Firestore implementation.
 */
function createMockBackend(options: Required<Pick<AttendanceServiceOptions, 'getCurrentUser' | 'now'>> & {
  sessions: PracticumSession[];
  attendances: AttendanceRecord[];
}) {
  const sessions = options.sessions;
  const attendances = options.attendances;
  const attendanceListeners = new Set<{
    sessionId?: string;
    praktikanId?: string;
    onData: AttendanceListener;
  }>();
  const sessionListeners = new Set<{
    sessionId: string;
    onData: SessionListener;
  }>();
  const sessionsListeners = new Set<SessionsListener>();

  const getSession = (sessionId: string) =>
    sessions.find((session) => session.id === sessionId);

  const emitAttendance = (sessionId?: string, praktikanId?: string) => {
    attendanceListeners.forEach((listener) => {
      if (listener.sessionId && listener.sessionId !== sessionId) return;
      if (listener.praktikanId && listener.praktikanId !== praktikanId) return;
      const records = attendances
        .filter((record) => !listener.sessionId || record.sessionId === listener.sessionId)
        .filter((record) => !listener.praktikanId || record.praktikanId === listener.praktikanId)
        .sort(byAttendedAt);
      listener.onData(clone(records));
    });
  };

  const emitSession = (sessionId: string) => {
    sessionListeners.forEach((listener) => {
      if (listener.sessionId === sessionId) {
        listener.onData(clone(getSession(sessionId) ?? null));
      }
    });
  };

  const emitSessions = () => {
    sessionsListeners.forEach((listener) => listener(clone(sessions)));
  };

  const openSession = async (sessionId: string): Promise<MutationResult> => {
    const session = getSession(sessionId);
    if (!session) return { ok: false, reason: 'Sesi tidak ditemukan.' };
    if (session.status === 'dibuka') {
      return { ok: false, reason: 'Sesi sudah dibuka.' };
    }
    if (session.status !== 'terjadwal') {
      return { ok: false, reason: 'Sesi yang sudah ditutup tidak dapat dibuka kembali.' };
    }

    session.status = 'dibuka';
    emitSession(sessionId);
    emitSessions();
    return { ok: true };
  };

  const closeSession = async (sessionId: string): Promise<MutationResult> => {
    const session = getSession(sessionId);
    if (!session) return { ok: false, reason: 'Sesi tidak ditemukan.' };
    if (session.status === 'ditutup') {
      return { ok: false, reason: 'Sesi sudah ditutup.' };
    }
    if (session.status !== 'dibuka') {
      return { ok: false, reason: 'Hanya sesi yang sedang dibuka yang dapat ditutup.' };
    }

    session.status = 'ditutup';
    emitSession(sessionId);
    emitSessions();
    return { ok: true };
  };

  const checkIn = async (
    sessionId: string,
    user: CurrentUser | null = options.getCurrentUser(),
    location: AttendanceLocation | null = null,
  ): Promise<MutationResult> => {
    const currentUser = options.getCurrentUser();

    if (!currentUser) {
      return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    }
    if (!user) {
      return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    }
    if (user.role !== 'praktikan') {
      return { ok: false, reason: 'Hanya praktikan yang dapat melakukan presensi.' };
    }
    if (!user.uid || user.uid !== currentUser.uid) {
      return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    }
    if (!user.name.trim()) {
      return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    }

    const session = getSession(sessionId);
    if (!session) return { ok: false, reason: 'Sesi tidak ditemukan.' };
    if (session.status !== 'dibuka') {
      return { ok: false, reason: ATTENDANCE_SESSION_NOT_OPEN_REASON };
    }

    const attendanceId = getAttendanceDocId(sessionId, user.uid);
    if (attendances.some((record) => record.id === attendanceId)) {
      return { ok: false, reason: ATTENDANCE_ALREADY_CHECKED_IN_REASON };
    }

    attendances.push({
      id: attendanceId,
      sessionId,
      praktikanId: user.uid,
      praktikanName: user.name,
      attendedAt: options.now().toISOString(),
      status: 'hadir',
    });

    emitAttendance(sessionId, user.uid);
    return { ok: true };
  };

  return {
    openSession,
    closeSession,
    checkIn,
    subscribeToAttendance: (
      sessionId: string,
      onData: AttendanceListener,
      _onError?: ListenerErrorHandler,
      praktikanId?: string,
    ) => {
      const entry = { sessionId, praktikanId, onData };
      attendanceListeners.add(entry);
      onData(
        clone(attendances
          .filter((record) => record.sessionId === sessionId)
          .filter((record) => !praktikanId || record.praktikanId === praktikanId)
          .sort(byAttendedAt)),
      );
      return () => {
        attendanceListeners.delete(entry);
      };
    },
    subscribeToSession: (
      sessionId: string,
      onData: SessionListener,
      _onError?: ListenerErrorHandler,
    ) => {
      const entry = { sessionId, onData };
      sessionListeners.add(entry);
      onData(clone(getSession(sessionId) ?? null));
      return () => {
        sessionListeners.delete(entry);
      };
    },
    subscribeToSessions: (onData: SessionsListener, _onError?: ListenerErrorHandler) => {
      sessionsListeners.add(onData);
      onData(clone(sessions));
      return () => {
        sessionsListeners.delete(onData);
      };
    },
    subscribeToPraktikanAttendance: (
      praktikanId: string,
      onData: AttendanceListener,
      _onError?: ListenerErrorHandler,
    ) => {
      const entry = { praktikanId, onData };
      attendanceListeners.add(entry);
      onData(clone(attendances.filter((record) => record.praktikanId === praktikanId).sort(byAttendedAt)));
      return () => {
        attendanceListeners.delete(entry);
      };
    },
    subscribeToAllAttendance: (onData: AttendanceListener, _onError?: ListenerErrorHandler) => {
      const entry = { onData };
      attendanceListeners.add(entry);
      onData(clone([...attendances].sort(byAttendedAt)));
      return () => {
        attendanceListeners.delete(entry);
      };
    },
  };
}

/**
 * Firestore backend. Mutations use runTransaction so two simultaneous
 * check-ins cannot both create the same deterministic attendance document.
 */
function createFirestoreBackend(
  database: Firestore,
  options: Required<Pick<AttendanceServiceOptions, 'getCurrentUser' | 'now'>>,
): Omit<AttendanceService, 'mode'> {
  const openSession = async (sessionId: string): Promise<MutationResult> => {
    try {
      await runTransaction(database, async (transaction) => {
        const sessionRef = doc(database, 'sessions', sessionId);
        const sessionSnapshot = await transaction.get(sessionRef);

        if (!sessionSnapshot.exists()) {
          throw new AttendanceServiceError('Sesi tidak ditemukan.');
        }
        const status = sessionSnapshot.data().status;
        if (status === 'dibuka') {
          throw new AttendanceServiceError('Sesi sudah dibuka.');
        }
        if (status !== 'terjadwal') {
          throw new AttendanceServiceError('Sesi yang sudah ditutup tidak dapat dibuka kembali.');
        }

        const sessionData = sessionSnapshot.data();
        transaction.update(sessionRef, {
          status: 'dibuka',
          startsAt: sessionTimestampForWrite(sessionData.startsAt),
          endsAt: sessionTimestampForWrite(sessionData.endsAt),
        });
      });
      return { ok: true };
    } catch (error) {
      return toMutationFailure(error, 'openSession');
    }
  };

  const closeSession = async (sessionId: string): Promise<MutationResult> => {
    try {
      await runTransaction(database, async (transaction) => {
        const sessionRef = doc(database, 'sessions', sessionId);
        const sessionSnapshot = await transaction.get(sessionRef);

        if (!sessionSnapshot.exists()) {
          throw new AttendanceServiceError('Sesi tidak ditemukan.');
        }
        const status = sessionSnapshot.data().status;
        if (status === 'ditutup') {
          throw new AttendanceServiceError('Sesi sudah ditutup.');
        }
        if (status !== 'dibuka') {
          throw new AttendanceServiceError('Hanya sesi yang sedang dibuka yang dapat ditutup.');
        }

        const sessionData = sessionSnapshot.data();
        transaction.update(sessionRef, {
          status: 'ditutup',
          startsAt: sessionTimestampForWrite(sessionData.startsAt),
          endsAt: sessionTimestampForWrite(sessionData.endsAt),
        });
      });
      return { ok: true };
    } catch (error) {
      return toMutationFailure(error, 'closeSession');
    }
  };

  const checkIn = async (
    sessionId: string,
    user: CurrentUser | null = options.getCurrentUser(),
    location: AttendanceLocation | null = null,
  ): Promise<MutationResult> => {
    const currentUser = options.getCurrentUser();

    if (!currentUser || !user) {
      return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    }
    if (user.role !== 'praktikan') {
      return { ok: false, reason: 'Hanya praktikan yang dapat melakukan presensi.' };
    }
    if (!user.uid || user.uid !== currentUser.uid || isDummyPraktikanId(user.uid)) {
      return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    }

    if (!location) {
      return { ok: false, reason: 'Lokasi belum berhasil diperoleh. Silakan coba lagi.' };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
      const submitAttendance = httpsCallable<
        {
          sessionId: string;
          latitude: number;
          longitude: number;
          accuracyMeters: number;
        },
        { distanceMeters: number; radiusMeters: number }
      >(firebase.functions, 'submitAttendance');
      const response = await submitAttendance({
        sessionId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracyMeters,
      });
      if (!Number.isFinite(response.data.distanceMeters)
        || response.data.distanceMeters < 0
        || !Number.isFinite(response.data.radiusMeters)
        || response.data.radiusMeters <= 0) {
        return { ok: false, reason: 'Respons validasi presensi dari server tidak valid.' };
      }
      return {
        ok: true,
        distanceMeters: response.data.distanceMeters,
        radiusMeters: response.data.radiusMeters,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracyMeters,
      };
    } catch (error) {
      return {
        ok: false,
        reason: callableErrorMessage(error, 'Presensi ditolak oleh server.'),
      };
    }
  };

  const subscribeToAttendance = (
    sessionId: string,
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
    praktikanId?: string,
  ): AttendanceUnsubscribe => {
    const constraints = [where('sessionId', '==', sessionId)];
    if (praktikanId) constraints.push(where('praktikanId', '==', praktikanId));
    const attendanceQuery = query(
      collection(database, 'attendances'),
      ...constraints,
    );

    return onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const records = snapshot.docs
          .map((record) => mapAttendance(record.id, record.data()))
          .sort(byAttendedAt);
        onData(records);
      },
      (error) => onError?.(describeListenerError(error)),
    );
  };

  const subscribeToPraktikanAttendance = (
    praktikanId: string,
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
  ): AttendanceUnsubscribe => {
    const attendanceQuery = query(
      collection(database, 'attendances'),
      where('praktikanId', '==', praktikanId),
    );

    return onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const records = snapshot.docs
          .map((record) => mapAttendance(record.id, record.data()))
          .sort(byAttendedAt);
        onData(records);
      },
      (error) => onError?.(describeListenerError(error)),
    );
  };

  const subscribeToAllAttendance = (
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
  ): AttendanceUnsubscribe =>
    onSnapshot(
      collection(database, 'attendances'),
      (snapshot) => {
        const records = snapshot.docs
          .map((record) => mapAttendance(record.id, record.data()))
          .sort(byAttendedAt);
        onData(records);
      },
      (error) => onError?.(describeListenerError(error)),
    );

  const subscribeToSession = (
    sessionId: string,
    onData: SessionListener,
    onError?: ListenerErrorHandler,
  ): AttendanceUnsubscribe =>
    onSnapshot(
      doc(database, 'sessions', sessionId),
      (snapshot) => {
        onData(snapshot.exists() ? mapSession(snapshot.id, snapshot.data()) : null);
      },
      (error) => onError?.(describeListenerError(error)),
    );

  const subscribeToSessions = (
    onData: SessionsListener,
    onError?: ListenerErrorHandler,
  ): AttendanceUnsubscribe =>
    onSnapshot(
      collection(database, 'sessions'),
      (snapshot) => {
        onData(
          snapshot.docs
            .map((record) => mapSession(record.id, record.data()))
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
        );
      },
      (error) => onError?.(describeListenerError(error)),
    );

  return {
    openSession,
    closeSession,
    checkIn,
    subscribeToAttendance,
    subscribeToSession,
    subscribeToSessions,
    subscribeToPraktikanAttendance,
    subscribeToAllAttendance,
  };
}

export function createAttendanceService(
  options: AttendanceServiceOptions = {},
): AttendanceService {
  const mode: ServiceMode = options.mode ?? (isFirebaseConfigured ? 'firestore' : 'mock');
  const getCurrentUserFn = options.getCurrentUser ?? getAttendanceUser;
  const now = options.now ?? (() => new Date());
  const backendOptions = { getCurrentUser: getCurrentUserFn, now };

  if (mode === 'mock') {
    const backend = createMockBackend({
      ...backendOptions,
      sessions: clone(options.sessions ?? initialSessions),
      attendances: clone(seedAttendances(options.attendances ?? initialAttendances)),
    });
    return { mode, ...backend };
  }

  if (!options.database) {
    if (!isFirebaseConfigured) {
      throw new AttendanceServiceError(FIREBASE_NOT_CONFIGURED_MESSAGE);
    }
    throw new AttendanceServiceError('Instance Firestore tidak tersedia.');
  }

  return {
    mode,
    ...createFirestoreBackend(options.database, backendOptions),
  };
}

/**
 * Default service used by the screens. When the Firebase env variables are
 * empty, `mode` is `mock`; once configured, the same screens use Firestore.
 */
const configuredDatabase = getConfiguredDatabase();

export const attendanceService = createAttendanceService({
  mode: configuredDatabase ? 'firestore' : 'mock',
  database: configuredDatabase,
  getCurrentUser: getAttendanceUser,
});

export const attendanceServiceMode = attendanceService.mode;

export const openSession = (sessionId: string) => attendanceService.openSession(sessionId);
export const closeSession = async (sessionId: string): Promise<MutationResult> => {
  if (attendanceService.mode === 'mock') {
    return attendanceService.closeSession(sessionId);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    const close = httpsCallable<{ sessionId: string }, { ok: true }>(
      firebase.functions,
      'closeSession',
    );
    await close({ sessionId });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: callableErrorMessage(error, 'Sesi tidak dapat ditutup. Silakan coba lagi.'),
    };
  }
};
export const cancelAttendance = async (
  sessionId: string,
  attendanceId: string,
  reason?: string,
): Promise<MutationResult> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    const cancel = httpsCallable(firebase.functions, 'cancelAttendance');
    await cancel({ sessionId, attendanceId, reason: reason?.trim() ?? '' });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: callableErrorMessage(error, 'Pembatalan presensi ditolak oleh server.'),
    };
  }
};

type AttendanceQrResponse = {
  ok: true;
  qrPayload: string;
  expiresAt: string;
};

export type AttendanceQrResult =
  | AttendanceQrResponse
  | { ok: false; reason: string };

export type AttendanceQrValidationResult =
  | {
      ok: true;
      practicumName: string;
      className: string;
      expiresAt: string;
    }
  | { ok: false; reason: string };

export const issueAttendanceQr = async (sessionId: string): Promise<AttendanceQrResult> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    const issue = httpsCallable<{ sessionId: string }, AttendanceQrResponse>(
      firebase.functions,
      'issueAttendanceQr',
    );
    const response = await issue({ sessionId });
    if (response.data.ok !== true
      || typeof response.data.qrPayload !== 'string'
      || typeof response.data.expiresAt !== 'string') {
      return { ok: false, reason: 'Server mengirim data QR yang tidak valid.' };
    }
    return response.data;
  } catch (error) {
    return {
      ok: false,
      reason: callableErrorMessage(error, 'QR tidak dapat diterbitkan. Silakan coba lagi.'),
    };
  }
};

export const revokeAttendanceQr = async (sessionId: string): Promise<MutationResult> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    const revoke = httpsCallable<{ sessionId: string }, { ok: true; revoked: boolean }>(
      firebase.functions,
      'revokeAttendanceQr',
    );
    await revoke({ sessionId });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: callableErrorMessage(error, 'QR tidak dapat dicabut. Silakan coba lagi.'),
    };
  }
};

export const validateAttendanceQr = async (
  sessionId: string,
  qrPayload: string,
): Promise<AttendanceQrValidationResult> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    const validate = httpsCallable<
      { sessionId: string; qrPayload: string },
      {
        ok: true;
        practicumName: string;
        className: string;
        expiresAt: string;
      }
    >(firebase.functions, 'validateAttendanceQr');
    const response = await validate({ sessionId, qrPayload });
    if (response.data.ok !== true
      || typeof response.data.expiresAt !== 'string') {
      return { ok: false, reason: 'Respons validasi QR dari server tidak valid.' };
    }
    return response.data;
  } catch (error) {
    return {
      ok: false,
      reason: callableErrorMessage(error, 'QR tidak dapat divalidasi. Silakan coba lagi.'),
    };
  }
};

export const submitQrAttendance = async (
  sessionId: string,
  qrPayload: string,
  location: AttendanceLocation,
): Promise<MutationResult> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
    const submit = httpsCallable<
      {
        sessionId: string;
        qrPayload: string;
        latitude: number;
        longitude: number;
        accuracyMeters: number;
      },
      { ok: true; distanceMeters: number; radiusMeters: number }
    >(firebase.functions, 'submitQrAttendance');
    const response = await submit({
      sessionId,
      qrPayload,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracyMeters,
    });
    if (response.data.ok !== true
      || !Number.isFinite(response.data.distanceMeters)
      || response.data.distanceMeters < 0
      || !Number.isFinite(response.data.radiusMeters)
      || response.data.radiusMeters <= 0) {
      return { ok: false, reason: 'Respons validasi QR dari server tidak valid.' };
    }
    return {
      ok: true,
      distanceMeters: response.data.distanceMeters,
      radiusMeters: response.data.radiusMeters,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracyMeters,
    };
  } catch (error) {
    return {
      ok: false,
      reason: callableErrorMessage(error, 'Presensi QR gagal diproses. Silakan coba lagi.'),
    };
  }
};
/**
 * Check-in praktikan untuk satu sesi (SRS-09). `user` default diambil dari
 * identitas Auth aktif; `null` diperlakukan sebagai identitas tidak valid.
 *
 * @returns `{ ok: true }` bila `attendances/{sessionId}_{uid}` berhasil dibuat,
 * atau `{ ok: false, reason }` sesuai daftar alasan pada dokumentasi konstanta
 * `ATTENDANCE_*_REASON` di atas.
 */
export const checkIn = (
  sessionId: string,
  user?: CurrentUser | null,
  location?: AttendanceLocation | null,
) => attendanceService.checkIn(sessionId, user, location);
export const subscribeToAttendance = (
  sessionId: string,
  onData: AttendanceListener,
  onError?: ListenerErrorHandler,
  praktikanId?: string,
) => attendanceService.subscribeToAttendance(sessionId, onData, onError, praktikanId);
export const subscribeToSession = (
  sessionId: string,
  onData: SessionListener,
  onError?: ListenerErrorHandler,
) => attendanceService.subscribeToSession(sessionId, onData, onError);
export const subscribeToSessions = (
  onData: SessionsListener,
  onError?: ListenerErrorHandler,
) => attendanceService.subscribeToSessions(onData, onError);
export const subscribeToPraktikanAttendance = (
  praktikanId: string,
  onData: AttendanceListener,
  onError?: ListenerErrorHandler,
) =>
  attendanceService.subscribeToPraktikanAttendance(praktikanId, onData, onError);
/**
 * Berlangganan seluruh koleksi `attendances` (lintas sesi) untuk rekap
 * realtime asisten (SRS-10). Rules mengizinkan read bagi semua pengguna
 * terautentikasi, jadi tidak perlu filter `where`. Rekaman diurutkan naik
 * berdasarkan `attendedAt`, sama seperti listener per sesi.
 */
export const subscribeToAllAttendance = (
  onData: AttendanceListener,
  onError?: ListenerErrorHandler,
) => attendanceService.subscribeToAllAttendance(onData, onError);
