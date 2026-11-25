import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { Permit, PermitStatus } from '../features/permit/permit.types';
import { auth, db } from '../lib/firebase';

export type SubmitPermitInput = {
  sessionId: string;
  studentId: string;
  studentName: string;
  reason: string;
};

export type PermitMutationResult =
  | { ok: true; permit: Permit }
  | { ok: false; reason: string };

export type ReviewStatus = Extract<PermitStatus, 'approved' | 'rejected'>;

/**
 * `studentId` membatasi langganan ke izin milik satu praktikan.
 * Tanpa `studentId`, seluruh izin dibaca (dipakai asisten).
 */
export type PermitSubscriptionScope = {
  studentId?: string;
  sessionIds?: string[];
};

const PERMITS_COLLECTION = 'permits';
const MIN_REASON_LENGTH = 10;

/** ID dokumen izin: satu pengajuan per pasangan sesi + praktikan. */
export function getPermitId(sessionId: string, studentId: string): string {
  return `${sessionId}_${studentId}`;
}

type PermitOperationErrorCode = 'not-found' | 'already-reviewed' | 'already-submitted';

class PermitOperationError extends Error {
  constructor(public readonly code: PermitOperationErrorCode, message: string) {
    super(message);
    this.name = 'PermitOperationError';
  }
}

function firebaseErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  return typeof error.code === 'string' ? error.code : null;
}

function toPermit(id: string, data: Record<string, unknown>): Permit {
  return { id, ...(data as Omit<Permit, 'id'>) };
}

/** Pesan ramah pengguna untuk kegagalan Firestore pada fitur izin. */
export function getPermitErrorMessage(error: unknown): string {
  if (error instanceof PermitOperationError) {
    return error.message;
  }

  switch (firebaseErrorCode(error)) {
    case 'permission-denied':
      return 'Firestore menolak aksi ini. Pastikan akunmu terdaftar di kelas dan sesi masih terjadwal/dibuka serta belum lewat waktunya.';
    case 'unavailable':
    case 'deadline-exceeded':
    case 'network-request-failed':
      return 'Koneksi ke Firebase bermasalah. Periksa internet lalu coba lagi.';
    default:
      return 'Terjadi kesalahan saat menghubungi server. Silakan coba lagi.';
  }
}

/**
 * Menyimpan pengajuan izin ke koleksi Firestore `permits`.
 * Alasan izin tidak dianalisis sentimen; sentimen hanya dipakai untuk ulasan
 * pasca-praktikum di `reviewService`.
 */
export async function submitPermit(input: SubmitPermitInput): Promise<PermitMutationResult> {
  const reason = input.reason.trim();

  if (!input.sessionId) {
    return { ok: false, reason: 'Pilih sesi praktikum terlebih dahulu.' };
  }
  if (!input.studentId) {
    return { ok: false, reason: 'Identitas praktikan belum dipilih.' };
  }
  if (reason.length < MIN_REASON_LENGTH) {
    return { ok: false, reason: `Alasan izin minimal ${MIN_REASON_LENGTH} karakter.` };
  }

  const user = auth.currentUser;
  if (!user) {
    return { ok: false, reason: 'Sesi login berakhir. Masuk kembali untuk mengajukan izin.' };
  }
  if (user.uid !== input.studentId) {
    return { ok: false, reason: 'Identitas pengajuan tidak cocok dengan akun yang sedang masuk.' };
  }

  const payload = {
    sessionId: input.sessionId,
    studentId: user.uid,
    studentName: input.studentName,
    reason,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  };

  const permitId = getPermitId(input.sessionId, user.uid);

  try {
    const reference = doc(db, PERMITS_COLLECTION, permitId);
    const saved = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);

      if (snapshot.exists()) {
        throw new PermitOperationError(
          'already-submitted',
          'Kamu sudah mengajukan izin untuk sesi ini.',
        );
      }

      transaction.set(reference, payload);
      return { id: permitId, ...payload };
    });

    return { ok: true, permit: saved };
  } catch (error) {
    return { ok: false, reason: getPermitErrorMessage(error) };
  }
}

/**
 * Menyetujui atau menolak izin yang masih `pending`. Transaksi memastikan
 * status tidak direview dua kali oleh dua asisten sekaligus.
 */
export async function reviewPermit(
  permitId: string,
  status: ReviewStatus,
  reviewedBy?: string,
): Promise<PermitMutationResult> {
  if (!permitId) {
    return { ok: false, reason: 'Pengajuan izin tidak ditemukan.' };
  }

  const reviewedAt = new Date().toISOString();
  const reviewer = reviewedBy?.trim();

  try {
    const permit = await runTransaction(db, async (transaction) => {
      const reference = doc(db, PERMITS_COLLECTION, permitId);
      const snapshot = await transaction.get(reference);

      if (!snapshot.exists()) {
        throw new PermitOperationError('not-found', 'Pengajuan izin tidak ditemukan.');
      }

      const current = toPermit(snapshot.id, snapshot.data() as Record<string, unknown>);
      if (current.status !== 'pending') {
        throw new PermitOperationError('already-reviewed', 'Pengajuan izin ini sudah direview.');
      }

      const updates: Pick<Permit, 'status' | 'reviewedAt' | 'reviewedBy'> = {
        status,
        reviewedAt,
        ...(reviewer ? { reviewedBy: reviewer } : {}),
      };
      transaction.update(reference, updates);

      return { ...current, ...updates };
    });

    return { ok: true, permit };
  } catch (error) {
    return { ok: false, reason: getPermitErrorMessage(error) };
  }
}

/**
 * Berlangganan izin secara realtime lewat `onSnapshot`.
 * Asisten memakai `{}` untuk membaca semua izin, praktikan mengirim
 * `{ studentId }` agar query-nya sesuai Firestore security rules.
 */
export function subscribePermits(
  scope: PermitSubscriptionScope,
  onPermits: (permits: Permit[]) => void,
  onError?: (message: string) => void,
): () => void {
  if (scope.sessionIds) {
    const snapshots = new Map<string, Permit[]>();
    const unsubscribers = scope.sessionIds.map((sessionId) => onSnapshot(
      query(collection(db, PERMITS_COLLECTION), where('sessionId', '==', sessionId)),
      (snapshot) => {
        snapshots.set(sessionId, snapshot.docs.map((item) => toPermit(item.id, item.data())));
        onPermits([...snapshots.values()].flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (error) => onError?.(getPermitErrorMessage(error)),
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  const permitsQuery = query(
    collection(db, PERMITS_COLLECTION),
    where('studentId', '==', scope.studentId ?? ''),
  );

  return onSnapshot(
    permitsQuery,
    (snapshot) => {
      const permits = snapshot.docs
        .map((item) => toPermit(item.id, item.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onPermits(permits);
    },
    (error) => {
      onError?.(getPermitErrorMessage(error));
    },
  );
}
