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

export type AttendanceRecord = Attendance & {
  id: string;
  praktikanName: string;
};

export type AttendanceListener = (records: AttendanceRecord[]) => void;
export type SessionListener = (session: PracticumSession | null) => void;
export type SessionsListener = (sessions: PracticumSession[]) => void;
export type ListenerErrorHandler = (message: string) => void;
export type AttendanceUnsubscribe = Unsubscribe;

type ServiceMode = 'firestore' | 'mock';

export type AttendanceService = {
  mode: ServiceMode;
  openSession: (sessionId: string) => Promise<MutationResult>;
  closeSession: (sessionId: string) => Promise<MutationResult>;
  checkIn: (sessionId: string, user?: CurrentUser | null) => Promise<MutationResult>;
  subscribeToAttendance: (
    sessionId: string,
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
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
      // Check-in membaca dokumen enrollment di dalam transaksi. Bila dokumen
      // itu tidak ada, Firestore menolak `transaction.get` dengan
      // permission-denied sebelum validasi enrollment sempat berjalan,
      // sehingga alasan sebenarnya adalah enrollment belum terverifikasi.
      return { ok: false, reason: ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON };
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
  const status = data.status === 'izin' ? 'izin' : 'hadir';
  const excuseReason =
    data.excuseReason === 'sakit' || data.excuseReason === 'izin-lainnya'
      ? data.excuseReason
      : undefined;

  return {
    id,
    sessionId: String(data.sessionId ?? ''),
    praktikanId: String(data.praktikanId ?? ''),
    praktikanName: String(data.praktikanName ?? 'Praktikan'),
    attendedAt: typeof data.attendedAt === 'string' ? data.attendedAt : '',
    status,
    excuseReason,
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
    startsAt: String(data.startsAt ?? ''),
    endsAt: String(data.endsAt ?? ''),
    status,
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
    ) => {
      const entry = { sessionId, onData };
      attendanceListeners.add(entry);
      onData(
        clone(attendances.filter((record) => record.sessionId === sessionId).sort(byAttendedAt)),
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

        transaction.update(sessionRef, { status: 'dibuka' });
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

        transaction.update(sessionRef, { status: 'ditutup' });
      });
      return { ok: true };
    } catch (error) {
      return toMutationFailure(error, 'closeSession');
    }
  };

  const checkIn = async (
    sessionId: string,
    user: CurrentUser | null = options.getCurrentUser(),
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

    try {
      await runTransaction(database, async (transaction) => {
        const sessionRef = doc(database, 'sessions', sessionId);
        const attendanceRef = doc(
          database,
          'attendances',
          getAttendanceDocId(sessionId, user.uid),
        );
        const profileRef = doc(database, 'users', user.uid);

        const sessionSnapshot = await transaction.get(sessionRef);
        if (!sessionSnapshot.exists()) {
          throw new AttendanceServiceError('Sesi tidak ditemukan.');
        }
        const sessionData = sessionSnapshot.data();
        if (sessionData.status !== 'dibuka') {
          throw new AttendanceServiceError(ATTENDANCE_SESSION_NOT_OPEN_REASON);
        }

        const classId =
          typeof sessionData.classId === 'string' ? sessionData.classId.trim() : '';
        if (!classId) {
          throw new AttendanceServiceError(ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON);
        }

        const enrollmentRef = doc(
          database,
          'enrollments',
          `${classId}_${user.uid}`,
        );
        const enrollmentSnapshot = await transaction.get(enrollmentRef);
        const enrollment = enrollmentSnapshot.exists()
          ? enrollmentSnapshot.data()
          : null;
        if (
          !enrollment
          || enrollment.praktikanId !== user.uid
          || enrollment.classId !== classId
        ) {
          throw new AttendanceServiceError(ATTENDANCE_ENROLLMENT_UNVERIFIED_REASON);
        }

        const profileSnapshot = await transaction.get(profileRef);
        const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
        const profileUid = profile?.uid;
        const profileRole = profile?.role;
        const profileName =
          typeof profile?.name === 'string' ? profile.name.trim() : '';

        if (
          !profile
          || (profileUid !== undefined && profileUid !== user.uid)
          || profileRole !== 'praktikan'
          || !profileName
        ) {
          throw new AttendanceServiceError(ATTENDANCE_IDENTITY_INVALID_REASON);
        }

        const attendanceSnapshot = await transaction.get(attendanceRef);
        if (attendanceSnapshot.exists()) {
          throw new AttendanceServiceError(ATTENDANCE_ALREADY_CHECKED_IN_REASON);
        }

        transaction.set(attendanceRef, {
          sessionId,
          praktikanId: user.uid,
          praktikanName: profileName,
          attendedAt: options.now().toISOString(),
          status: 'hadir',
        });
      });
      return { ok: true };
    } catch (error) {
      return toMutationFailure(error, 'checkIn');
    }
  };

  const subscribeToAttendance = (
    sessionId: string,
    onData: AttendanceListener,
    onError?: ListenerErrorHandler,
  ): AttendanceUnsubscribe => {
    const attendanceQuery = query(
      collection(database, 'attendances'),
      where('sessionId', '==', sessionId),
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
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
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
export const closeSession = (sessionId: string) => attendanceService.closeSession(sessionId);
/**
 * Check-in praktikan untuk satu sesi (SRS-09). `user` default diambil dari
 * identitas Auth aktif; `null` diperlakukan sebagai identitas tidak valid.
 *
 * @returns `{ ok: true }` bila `attendances/{sessionId}_{uid}` berhasil dibuat,
 * atau `{ ok: false, reason }` sesuai daftar alasan pada dokumentasi konstanta
 * `ATTENDANCE_*_REASON` di atas.
 */
export const checkIn = (sessionId: string, user?: CurrentUser | null) =>
  attendanceService.checkIn(sessionId, user);
export const subscribeToAttendance = (
  sessionId: string,
  onData: AttendanceListener,
  onError?: ListenerErrorHandler,
) => attendanceService.subscribeToAttendance(sessionId, onData, onError);
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
