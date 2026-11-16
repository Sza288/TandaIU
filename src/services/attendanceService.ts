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
  checkIn: (sessionId: string, user?: CurrentUser) => Promise<MutationResult>;
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
};

export type AttendanceServiceOptions = {
  mode?: ServiceMode;
  database?: Firestore;
  getCurrentUser?: () => CurrentUser;
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
 * the mock-mode demo can start. This delegates to getCurrentUser() as soon as
 * the real configuration is available.
 */
export function getAttendanceUser(): CurrentUser {
  if (!isFirebaseConfigured) return MOCK_USER;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const session = require('../lib/currentSession') as typeof import('../lib/currentSession');
    return session.getCurrentUser();
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[attendanceService] getCurrentUser gagal, memakai identitas demo.', error);
    }
    return MOCK_USER;
  }
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

function toMutationFailure(error: unknown): MutationResult {
  if (error instanceof AttendanceServiceError) {
    return { ok: false, reason: error.message };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'permission-denied'
  ) {
    return {
      ok: false,
      reason: 'Akses ditolak. Periksa Firestore Security Rules untuk koleksi attendances.',
    };
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
    user: CurrentUser = options.getCurrentUser(),
  ): Promise<MutationResult> => {
    const currentUser = options.getCurrentUser();

    if (user.role !== 'praktikan') {
      return { ok: false, reason: 'Hanya praktikan yang dapat melakukan presensi.' };
    }
    if (!user.uid || user.uid !== currentUser.uid) {
      return { ok: false, reason: 'Presensi hanya dapat dilakukan untuk akun sendiri.' };
    }

    const session = getSession(sessionId);
    if (!session) return { ok: false, reason: 'Sesi tidak ditemukan.' };
    if (session.status !== 'dibuka') {
      return { ok: false, reason: 'Presensi hanya tersedia saat sesi dibuka.' };
    }

    const attendanceId = getAttendanceDocId(sessionId, user.uid);
    if (attendances.some((record) => record.id === attendanceId)) {
      return { ok: false, reason: 'Kamu sudah melakukan presensi pada sesi ini.' };
    }

    attendances.push({
      id: attendanceId,
      sessionId,
      praktikanId: user.uid,
      praktikanName: user.name,
      attendedAt: options.now().toISOString(),
      status: 'hadir',
    });

    emitAttendance(sessionId);
    emitAttendance(undefined, user.uid);
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
      return toMutationFailure(error);
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
      return toMutationFailure(error);
    }
  };

  const checkIn = async (
    sessionId: string,
    user: CurrentUser = options.getCurrentUser(),
  ): Promise<MutationResult> => {
    const currentUser = options.getCurrentUser();

    if (user.role !== 'praktikan') {
      return { ok: false, reason: 'Hanya praktikan yang dapat melakukan presensi.' };
    }
    if (!user.uid || user.uid !== currentUser.uid) {
      return { ok: false, reason: 'Presensi hanya dapat dilakukan untuk akun sendiri.' };
    }

    try {
      await runTransaction(database, async (transaction) => {
        const sessionRef = doc(database, 'sessions', sessionId);
        const attendanceRef = doc(
          database,
          'attendances',
          getAttendanceDocId(sessionId, user.uid),
        );

        const sessionSnapshot = await transaction.get(sessionRef);
        if (!sessionSnapshot.exists()) {
          throw new AttendanceServiceError('Sesi tidak ditemukan.');
        }
        if (sessionSnapshot.data().status !== 'dibuka') {
          throw new AttendanceServiceError('Presensi hanya tersedia saat sesi dibuka.');
        }

        const attendanceSnapshot = await transaction.get(attendanceRef);
        if (attendanceSnapshot.exists()) {
          throw new AttendanceServiceError('Kamu sudah melakukan presensi pada sesi ini.');
        }

        transaction.set(attendanceRef, {
          sessionId,
          praktikanId: user.uid,
          praktikanName: user.name,
          attendedAt: options.now().toISOString(),
          status: 'hadir',
        });
      });
      return { ok: true };
    } catch (error) {
      return toMutationFailure(error);
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
export const checkIn = (sessionId: string, user?: CurrentUser) =>
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
