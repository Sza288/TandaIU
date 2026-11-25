import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type Transaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { initialAttendances } from '../data/attendances';
import { initialSessions } from '../data/sessions';
import { praktikans } from '../data/praktikans';
import type { CurrentUser } from '../lib/currentSession';
import type { Attendance, MutationResult, PracticumSession } from '../types';
import { measureAttendanceDistance, validateAttendancePosition } from '../utils/attendanceLocation';
import { firestoreDateToIso } from '../utils/firestoreDate';
import { parseAttendanceQrPayload } from '../utils/attendanceQr';

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
  cancelAttendance: (
    sessionId: string,
    attendanceId: string,
    reason?: string,
  ) => Promise<MutationResult>;
  issueAttendanceQr: (sessionId: string) => Promise<AttendanceQrResult>;
  revokeAttendanceQr: (sessionId: string) => Promise<MutationResult>;
  validateAttendanceQr: (
    sessionId: string,
    qrPayload: string,
  ) => Promise<AttendanceQrValidationResult>;
  submitQrAttendance: (
    sessionId: string,
    qrPayload: string,
    location: AttendanceLocation,
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

const GENERIC_LISTENER_ERROR =
  'Gagal memuat data presensi. Periksa koneksi dan konfigurasi Firebase.';
const FIREBASE_NOT_CONFIGURED_MESSAGE =
  'Firebase belum dikonfigurasi. Isi variabel EXPO_PUBLIC_FIREBASE_* pada .env.';

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

const QR_TTL_MILLISECONDS = 2 * 60 * 1000;
const QR_PREFIX = 'TANDAIU-ATTENDANCE:1:';

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AttendanceServiceError) return error.message;
  if (typeof error !== 'object' || error === null) return fallback;

  const firestoreError = error as { code?: unknown; message?: unknown };
  if (firestoreError.code === 'permission-denied') {
    return 'Aksi ditolak oleh Firestore. Pastikan akun, enrollment, dan Security Rules sesuai.';
  }
  if (firestoreError.code === 'already-exists') return ATTENDANCE_ALREADY_CHECKED_IN_REASON;
  if (firestoreError.code === 'unauthenticated') return ATTENDANCE_IDENTITY_INVALID_REASON;
  return typeof firestoreError.message === 'string' && firestoreError.message.trim()
    ? firestoreError.message
    : fallback;
}

function valueToMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const toMillis = (value as { toMillis?: unknown }).toMillis;
    if (typeof toMillis === 'function') {
      const millis = toMillis.call(value);
      return typeof millis === 'number' && Number.isFinite(millis) ? millis : null;
    }
  }
  return null;
}

function hasSessionWindow(session: DocumentData, now: Date): boolean {
  const startsAt = valueToMillis(session.startsAt);
  const endsAt = valueToMillis(session.endsAt);
  return startsAt !== null && endsAt !== null && endsAt > startsAt
    && startsAt <= now.getTime() && now.getTime() < endsAt;
}

function createQrToken(database: Firestore): string {
  return Array.from({ length: 3 }, () => doc(collection(database, 'attendanceQrTokens')).id)
    .join('')
    .slice(0, 43);
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

  const cancelAttendance = async (
    sessionId: string,
    attendanceId: string,
    reason = '',
  ): Promise<MutationResult> => {
    const record = attendances.find((item) => item.id === attendanceId);
    if (!record || record.sessionId !== sessionId) {
      return { ok: false, reason: 'Data presensi tidak ditemukan pada sesi ini.' };
    }
    if (record.status !== 'hadir') {
      return { ok: false, reason: 'Hanya presensi berhasil yang dapat dibatalkan.' };
    }
    const currentUser = options.getCurrentUser();
    if (!currentUser || currentUser.role !== 'asisten') {
      return { ok: false, reason: 'Hanya asisten yang dapat membatalkan presensi.' };
    }
    if (reason.trim().length > 300) {
      return { ok: false, reason: 'Alasan pembatalan maksimal 300 karakter.' };
    }
    record.status = 'dibatalkan';
    record.cancelledAt = options.now().toISOString();
    record.cancelledBy = currentUser.uid;
    record.cancelReason = reason.trim();
    emitAttendance(sessionId, record.praktikanId);
    return { ok: true };
  };

  const qrUnavailable = {
    ok: false as const,
    reason: 'QR presensi memerlukan Firebase Firestore yang telah dikonfigurasi.',
  };

  return {
    openSession,
    closeSession,
    checkIn,
    cancelAttendance,
    issueAttendanceQr: async (): Promise<AttendanceQrResult> => qrUnavailable,
    revokeAttendanceQr: async (): Promise<MutationResult> => qrUnavailable,
    validateAttendanceQr: async (): Promise<AttendanceQrValidationResult> => qrUnavailable,
    submitQrAttendance: async (): Promise<MutationResult> => qrUnavailable,
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
  const requireCurrentUser = (): CurrentUser | null => {
    const user = options.getCurrentUser();
    return user?.uid && !isDummyPraktikanId(user.uid) ? user : null;
  };

  const getProfile = async (
    transaction: Transaction,
    uid: string,
  ) => transaction.get(doc(database, 'users', uid));

  const openSession = async (sessionId: string): Promise<MutationResult> => {
    const user = requireCurrentUser();
    if (!user) return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    try {
      await runTransaction(database, async (transaction) => {
        const profile = await getProfile(transaction, user.uid);
        if (!profile.exists() || !['asisten', 'assistant'].includes(profile.data().role)) {
          throw new AttendanceServiceError('Hanya asisten yang dapat membuka sesi.');
        }
        const sessionRef = doc(database, 'sessions', sessionId);
        const session = await transaction.get(sessionRef);
        if (!session.exists()) throw new AttendanceServiceError('Sesi tidak ditemukan.');
        const data = session.data();
        if (data.assistantUid !== user.uid) {
          throw new AttendanceServiceError('Anda tidak memiliki kewenangan terhadap sesi ini.');
        }
        if (data.status === 'dibuka') throw new AttendanceServiceError('Sesi sudah dibuka.');
        if (data.status !== 'terjadwal') {
          throw new AttendanceServiceError('Sesi yang sudah ditutup tidak dapat dibuka kembali.');
        }
        const startsAt = valueToMillis(data.startsAt);
        const endsAt = valueToMillis(data.endsAt);
        if (startsAt === null || endsAt === null || endsAt <= startsAt) {
          throw new AttendanceServiceError('Waktu sesi praktikum tidak valid.');
        }
        if (endsAt <= options.now().getTime()) {
          throw new AttendanceServiceError('Sesi yang waktunya sudah berakhir tidak dapat dibuka.');
        }
        transaction.update(sessionRef, { status: 'dibuka' });
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: mutationErrorMessage(error, 'Sesi tidak dapat dibuka. Silakan coba lagi.') };
    }
  };

  const closeSession = async (sessionId: string): Promise<MutationResult> => {
    const user = requireCurrentUser();
    if (!user) return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    try {
      await runTransaction(database, async (transaction) => {
        const profile = await getProfile(transaction, user.uid);
        if (!profile.exists() || !['asisten', 'assistant'].includes(profile.data().role)) {
          throw new AttendanceServiceError('Hanya asisten yang dapat menutup sesi.');
        }
        const sessionRef = doc(database, 'sessions', sessionId);
        const session = await transaction.get(sessionRef);
        if (!session.exists()) throw new AttendanceServiceError('Sesi tidak ditemukan.');
        const data = session.data();
        if (data.assistantUid !== user.uid) {
          throw new AttendanceServiceError('Anda tidak memiliki kewenangan terhadap sesi ini.');
        }
        if (data.status !== 'dibuka') {
          throw new AttendanceServiceError('Hanya sesi yang sedang dibuka yang dapat ditutup.');
        }
        const qrRef = doc(database, 'attendanceQrTokens', sessionId);
        const qr = await transaction.get(qrRef);
        transaction.update(sessionRef, { status: 'ditutup' });
        if (qr.exists() && qr.data().revokedAt == null) {
          transaction.update(qrRef, {
            revokedAt: serverTimestamp(),
            revokedBy: user.uid,
          });
        }
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: mutationErrorMessage(error, 'Sesi tidak dapat ditutup. Silakan coba lagi.') };
    }
  };

  const checkIn = (
    sessionId: string,
    user: CurrentUser | null = options.getCurrentUser(),
    location: AttendanceLocation | null = null,
  ): Promise<MutationResult> =>
    recordCheckIn(sessionId, user, location, 'location');

  const recordCheckIn = async (
    sessionId: string,
    requestedUser: CurrentUser | null,
    location: AttendanceLocation | null,
    method: 'location' | 'qr',
    qrPayload?: string,
  ): Promise<MutationResult> => {
    const currentUser = requireCurrentUser();
    if (!currentUser || !requestedUser || requestedUser.uid !== currentUser.uid
      || requestedUser.role !== 'praktikan') {
      return { ok: false, reason: requestedUser?.role === 'asisten'
        ? 'Hanya praktikan yang dapat melakukan presensi.'
        : ATTENDANCE_IDENTITY_INVALID_REASON };
    }
    if (!location) return { ok: false, reason: 'Lokasi belum berhasil diperoleh. Silakan coba lagi.' };
    const positionValidation = validateAttendancePosition(location);
    if (!positionValidation.ok) return positionValidation;

    const qrToken = method === 'qr' && qrPayload
      ? parseAttendanceQrPayload(qrPayload)
      : null;
    if (method === 'qr' && !qrToken) return { ok: false, reason: 'QR presensi tidak valid.' };

    try {
      return await runTransaction(database, async (transaction) => {
        const profile = await getProfile(transaction, currentUser.uid);
        if (!profile.exists() || profile.data().role !== 'praktikan') {
          throw new AttendanceServiceError(ATTENDANCE_IDENTITY_INVALID_REASON);
        }
        const profileData = profile.data();
        if (typeof profileData.name !== 'string' || !profileData.name.trim()) {
          throw new AttendanceServiceError(ATTENDANCE_IDENTITY_INVALID_REASON);
        }
        const sessionRef = doc(database, 'sessions', sessionId);
        const sessionSnapshot = await transaction.get(sessionRef);
        if (!sessionSnapshot.exists()) throw new AttendanceServiceError('Sesi tidak ditemukan.');
        const session = sessionSnapshot.data();
        if (session.status !== 'dibuka') {
          throw new AttendanceServiceError(ATTENDANCE_SESSION_NOT_OPEN_REASON);
        }
        if (!(session.startsAt instanceof Timestamp) || !(session.endsAt instanceof Timestamp)) {
          throw new AttendanceServiceError(
            'Data waktu sesi belum berupa Firestore Timestamp. Sesi perlu diperbaiki sebelum presensi dapat dicatat.',
          );
        }
        if (!hasSessionWindow(session, options.now())) {
          throw new AttendanceServiceError(ATTENDANCE_SESSION_NOT_OPEN_REASON);
        }
        const classId = typeof session.classId === 'string' ? session.classId : '';
        const laboratoryId = typeof session.laboratoryId === 'string' ? session.laboratoryId : '';
        if (!classId) throw new AttendanceServiceError(ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON);
        if (!laboratoryId) {
          throw new AttendanceServiceError('Sesi offline tidak memiliki laboratorium yang valid.');
        }

        const classSnapshot = await transaction.get(doc(database, 'classes', classId));
        const enrollmentSnapshot = await transaction.get(
          doc(database, 'enrollments', `${classId}_${currentUser.uid}`),
        );
        if (!classSnapshot.exists() || !enrollmentSnapshot.exists()) {
          throw new AttendanceServiceError(ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON);
        }
        const classData = classSnapshot.data();
        const enrollment = enrollmentSnapshot.data();
        if (classData.courseId !== session.courseId
          || classData.className !== session.className
          || classData.semester !== session.semester
          || enrollment.praktikanId !== currentUser.uid
          || enrollment.classId !== classId
          || enrollment.courseId !== session.courseId
          || enrollment.semester !== session.semester) {
          throw new AttendanceServiceError(ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON);
        }

        const laboratorySnapshot = await transaction.get(
          doc(database, 'laboratories', laboratoryId),
        );
        if (!laboratorySnapshot.exists()) {
          throw new AttendanceServiceError('Data laboratorium sesi ini tidak ditemukan.');
        }
        const laboratory = laboratorySnapshot.data();
        if (typeof laboratory.name !== 'string' || !laboratory.name.trim()) {
          throw new AttendanceServiceError('Nama laboratorium tidak valid.');
        }
        const distance = measureAttendanceDistance(location, {
          latitude: laboratory.latitude,
          longitude: laboratory.longitude,
          radius: laboratory.radius,
        });
        if (!distance.ok) throw new AttendanceServiceError(distance.reason);
        const attendanceRef = doc(
          database,
          'attendances',
          getAttendanceDocId(sessionId, currentUser.uid),
        );
        const existingAttendance = await transaction.get(attendanceRef);
        if (existingAttendance.exists()) {
          throw new AttendanceServiceError(ATTENDANCE_ALREADY_CHECKED_IN_REASON);
        }

        if (method === 'qr' && qrToken) {
          const qrSnapshot = await transaction.get(
            doc(database, 'attendanceQrTokens', sessionId),
          );
          const qrData = qrSnapshot.data();
          const expiry = qrData ? valueToMillis(qrData.expiresAt) : null;
          if (!qrSnapshot.exists() || !qrData
            || qrData.sessionId !== sessionId || qrData.token !== qrToken) {
            throw new AttendanceServiceError('QR tidak berlaku untuk sesi yang dipilih.');
          }
          if (qrData.revokedAt != null) {
            throw new AttendanceServiceError('QR telah dicabut oleh asisten.');
          }
          if (expiry === null || expiry <= options.now().getTime()) {
            throw new AttendanceServiceError('QR presensi sudah kedaluwarsa. Minta asisten memperbarui QR.');
          }
        }

        const attendanceData = {
          sessionId,
          praktikanId: currentUser.uid,
          praktikanName: typeof profileData.name === 'string' ? profileData.name : '',
          attendedAt: serverTimestamp(),
          status: 'hadir',
          attendanceMethod: method,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters: location.accuracyMeters,
          distanceMeters: distance.distanceMeters,
          laboratoryId,
          laboratoryName: laboratory.name.trim(),
          radiusMeters: distance.radiusMeters,
          ...(qrToken ? { qrToken } : {}),
        };
        transaction.set(attendanceRef, attendanceData);
        return {
          ok: true,
          distanceMeters: distance.distanceMeters,
          radiusMeters: distance.radiusMeters,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters: location.accuracyMeters,
        };
      });
    } catch (error) {
      return { ok: false, reason: mutationErrorMessage(error, 'Presensi ditolak. Silakan coba lagi.') };
    }
  };

  const cancelAttendance = async (
    sessionId: string,
    attendanceId: string,
    reason = '',
  ): Promise<MutationResult> => {
    const user = requireCurrentUser();
    if (!user) return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    const trimmedReason = reason.trim();
    if (trimmedReason.length > 300) {
      return { ok: false, reason: 'Alasan pembatalan maksimal 300 karakter.' };
    }
    try {
      await runTransaction(database, async (transaction) => {
        const profile = await getProfile(transaction, user.uid);
        if (!profile.exists() || !['asisten', 'assistant'].includes(profile.data().role)) {
          throw new AttendanceServiceError('Hanya asisten yang dapat membatalkan presensi.');
        }
        const session = await transaction.get(doc(database, 'sessions', sessionId));
        if (!session.exists()) throw new AttendanceServiceError('Sesi tidak ditemukan.');
        if (session.data().assistantUid !== user.uid) {
          throw new AttendanceServiceError('Anda tidak memiliki kewenangan terhadap sesi ini.');
        }
        const attendanceRef = doc(database, 'attendances', attendanceId);
        const attendance = await transaction.get(attendanceRef);
        if (!attendance.exists() || attendance.data().sessionId !== sessionId) {
          throw new AttendanceServiceError('Data presensi tidak ditemukan pada sesi ini.');
        }
        if (attendance.data().status !== 'hadir') {
          throw new AttendanceServiceError('Hanya presensi berhasil yang dapat dibatalkan.');
        }
        transaction.update(attendanceRef, {
          status: 'dibatalkan',
          cancelledAt: serverTimestamp(),
          cancelledBy: user.uid,
          cancelReason: trimmedReason || null,
        });
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: mutationErrorMessage(error, 'Pembatalan presensi ditolak.') };
    }
  };

  const issueAttendanceQr = async (sessionId: string): Promise<AttendanceQrResult> => {
    const user = requireCurrentUser();
    if (!user) return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    const token = createQrToken(database);
    const expiresAt = Timestamp.fromDate(new Date(options.now().getTime() + QR_TTL_MILLISECONDS));
    try {
      await runTransaction(database, async (transaction) => {
        const profile = await getProfile(transaction, user.uid);
        if (!profile.exists() || !['asisten', 'assistant'].includes(profile.data().role)) {
          throw new AttendanceServiceError('Hanya asisten yang dapat menerbitkan QR.');
        }
        const session = await transaction.get(doc(database, 'sessions', sessionId));
        if (!session.exists()) throw new AttendanceServiceError('Sesi tidak ditemukan.');
        if (session.data().assistantUid !== user.uid) {
          throw new AttendanceServiceError('Anda tidak memiliki kewenangan terhadap sesi ini.');
        }
        if (session.data().status !== 'dibuka') {
          throw new AttendanceServiceError('QR hanya dapat diterbitkan ketika sesi dibuka.');
        }
        transaction.set(doc(database, 'attendanceQrTokens', sessionId), {
          sessionId,
          token,
          issuedBy: user.uid,
          issuedAt: serverTimestamp(),
          expiresAt,
          revokedAt: null,
          revokedBy: null,
        });
      });
      return {
        ok: true,
        qrPayload: `${QR_PREFIX}${token}`,
        expiresAt: expiresAt.toDate().toISOString(),
      };
    } catch (error) {
      return { ok: false, reason: mutationErrorMessage(error, 'QR tidak dapat diterbitkan. Silakan coba lagi.') };
    }
  };

  const revokeAttendanceQr = async (sessionId: string): Promise<MutationResult> => {
    const user = requireCurrentUser();
    if (!user) return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    try {
      await runTransaction(database, async (transaction) => {
        const profile = await getProfile(transaction, user.uid);
        if (!profile.exists() || !['asisten', 'assistant'].includes(profile.data().role)) {
          throw new AttendanceServiceError('Hanya asisten yang dapat mencabut QR.');
        }
        const session = await transaction.get(doc(database, 'sessions', sessionId));
        if (!session.exists()) throw new AttendanceServiceError('Sesi tidak ditemukan.');
        if (session.data().assistantUid !== user.uid) {
          throw new AttendanceServiceError('Anda tidak memiliki kewenangan terhadap sesi ini.');
        }
        const qrRef = doc(database, 'attendanceQrTokens', sessionId);
        const qr = await transaction.get(qrRef);
        if (qr.exists() && qr.data().revokedAt == null) {
          transaction.update(qrRef, {
            revokedAt: serverTimestamp(),
            revokedBy: user.uid,
          });
        }
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: mutationErrorMessage(error, 'QR tidak dapat dicabut. Silakan coba lagi.') };
    }
  };

  const validateAttendanceQr = async (
    sessionId: string,
    qrPayload: string,
  ): Promise<AttendanceQrValidationResult> => {
    const user = requireCurrentUser();
    const token = parseAttendanceQrPayload(qrPayload);
    if (!user) return { ok: false, reason: ATTENDANCE_IDENTITY_INVALID_REASON };
    if (!token) return { ok: false, reason: 'QR presensi tidak valid.' };
    try {
      return await runTransaction(database, async (transaction) => {
        const profile = await getProfile(transaction, user.uid);
        if (!profile.exists() || profile.data().role !== 'praktikan') {
          throw new AttendanceServiceError('Hanya praktikan yang dapat menggunakan QR presensi.');
        }
        const sessionSnapshot = await transaction.get(doc(database, 'sessions', sessionId));
        if (!sessionSnapshot.exists()) throw new AttendanceServiceError('Sesi tidak ditemukan.');
        const session = sessionSnapshot.data();
        if (session.status !== 'dibuka' || !hasSessionWindow(session, options.now())) {
          throw new AttendanceServiceError(ATTENDANCE_SESSION_NOT_OPEN_REASON);
        }
        const classId = typeof session.classId === 'string' ? session.classId : '';
        const enrollment = await transaction.get(
          doc(database, 'enrollments', `${classId}_${user.uid}`),
        );
        if (!classId || !enrollment.exists()
          || enrollment.data().praktikanId !== user.uid
          || enrollment.data().classId !== classId
          || enrollment.data().courseId !== session.courseId
          || enrollment.data().semester !== session.semester) {
          throw new AttendanceServiceError(ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON);
        }
        const qr = await transaction.get(doc(database, 'attendanceQrTokens', sessionId));
        const qrData = qr.data();
        const expiry = qrData ? valueToMillis(qrData.expiresAt) : null;
        if (!qr.exists() || !qrData || qrData.sessionId !== sessionId || qrData.token !== token) {
          throw new AttendanceServiceError('QR tidak berlaku untuk sesi yang dipilih.');
        }
        if (qrData.revokedAt != null) throw new AttendanceServiceError('QR telah dicabut oleh asisten.');
        if (expiry === null || expiry <= options.now().getTime()) {
          throw new AttendanceServiceError('QR presensi sudah kedaluwarsa. Minta asisten memperbarui QR.');
        }
        return {
          ok: true,
          practicumName: typeof session.practicumName === 'string' ? session.practicumName : '',
          className: typeof session.className === 'string' ? session.className : '',
          expiresAt: new Date(expiry).toISOString(),
        };
      });
    } catch (error) {
      return { ok: false, reason: mutationErrorMessage(error, 'QR tidak dapat divalidasi. Silakan coba lagi.') };
    }
  };

  const submitQrAttendance = (
    sessionId: string,
    qrPayload: string,
    location: AttendanceLocation,
  ): Promise<MutationResult> =>
    recordCheckIn(sessionId, options.getCurrentUser(), location, 'qr', qrPayload);

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
    cancelAttendance,
    issueAttendanceQr,
    revokeAttendanceQr,
    validateAttendanceQr,
    submitQrAttendance,
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
export const closeSession = (sessionId: string) => attendanceService.closeSession(sessionId);
export const cancelAttendance = (
  sessionId: string,
  attendanceId: string,
  reason?: string,
): Promise<MutationResult> => attendanceService.cancelAttendance(sessionId, attendanceId, reason);
export const issueAttendanceQr = (sessionId: string): Promise<AttendanceQrResult> =>
  attendanceService.issueAttendanceQr(sessionId);
export const revokeAttendanceQr = (sessionId: string): Promise<MutationResult> =>
  attendanceService.revokeAttendanceQr(sessionId);
export const validateAttendanceQr = (
  sessionId: string,
  qrPayload: string,
): Promise<AttendanceQrValidationResult> =>
  attendanceService.validateAttendanceQr(sessionId, qrPayload);
export const submitQrAttendance = (
  sessionId: string,
  qrPayload: string,
  location: AttendanceLocation,
): Promise<MutationResult> =>
  attendanceService.submitQrAttendance(sessionId, qrPayload, location);
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
