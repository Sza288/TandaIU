import { dummyPermits } from '../data/permits';
import { Permit, PermitStatus } from '../features/permit/permit.types';
import { analyzePermitSentiment } from '../features/permit/sentiment';

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

const MIN_REASON_LENGTH = 10;

/**
 * Penyimpanan lokal pengganti koleksi Firestore `permits`.
 * Data dan listener bersifat in-memory, sehingga perubahan langsung terlihat
 * di semua layar dan kembali ke data awal saat aplikasi dimuat ulang.
 */
let permits: Permit[] = [...dummyPermits];
const listeners = new Set<() => void>();
let sequence = 0;

function notify() {
  listeners.forEach((listener) => listener());
}

export function getPermits(): Permit[] {
  return permits;
}

export function getPermitById(permitId: string): Permit | undefined {
  return permits.find((permit) => permit.id === permitId);
}

export function subscribePermits(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

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

  const { sentiment, source } = await analyzePermitSentiment(reason);
  const permit: Permit = {
    id: `perm-${Date.now()}-${sequence}`,
    sessionId: input.sessionId,
    studentId: input.studentId,
    studentName: input.studentName,
    reason,
    sentiment,
    sentimentSource: source,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  sequence += 1;
  permits = [permit, ...permits];
  notify();

  return { ok: true, permit };
}

export async function reviewPermit(
  permitId: string,
  status: ReviewStatus,
  reviewedBy?: string,
): Promise<PermitMutationResult> {
  const current = permits.find((permit) => permit.id === permitId);
  if (!current) {
    return { ok: false, reason: 'Pengajuan izin tidak ditemukan.' };
  }
  if (current.status !== 'pending') {
    return { ok: false, reason: 'Pengajuan izin ini sudah direview.' };
  }

  const updated: Permit = {
    ...current,
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy,
  };

  permits = permits.map((permit) => (permit.id === permitId ? updated : permit));
  notify();

  return { ok: true, permit: updated };
}

/** Mengembalikan penyimpanan ke kondisi awal. Dipakai oleh unit test. */
export function __resetPermitsForTests(seed: Permit[] = dummyPermits) {
  permits = [...seed];
  sequence = 0;
  notify();
}
