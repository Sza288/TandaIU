import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { Review } from '../features/review/review.types';
import { analyzeReviewSentiment } from '../features/review/sentiment';
import { auth, db } from '../lib/firebase';

export type SubmitReviewInput = {
  sessionId: string;
  studentId: string;
  studentName: string;
  comment: string;
};

export type ReviewMutationResult =
  | { ok: true; review: Review }
  | { ok: false; reason: string };

/**
 * `studentId` membatasi langganan ke ulasan milik satu praktikan.
 * Tanpa `studentId`, seluruh ulasan dibaca (dipakai asisten).
 */
export type ReviewSubscriptionScope = {
  studentId?: string;
};

const REVIEWS_COLLECTION = 'reviews';
const MIN_COMMENT_LENGTH = 10;

/** ID dokumen ulasan: satu ulasan per pasangan sesi + praktikan. */
export function getReviewId(sessionId: string, studentId: string): string {
  return `${sessionId}_${studentId}`;
}

function firebaseErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  return typeof error.code === 'string' ? error.code : null;
}

function toReview(id: string, data: Record<string, unknown>): Review {
  return { id, ...(data as Omit<Review, 'id'>) };
}

/** Pesan ramah pengguna untuk kegagalan Firestore pada fitur ulasan. */
export function getReviewErrorMessage(error: unknown): string {
  switch (firebaseErrorCode(error)) {
    case 'permission-denied':
      return 'Firestore menolak ulasan ini. Pastikan sesi sudah ditutup dan kamu belum mengirim ulasan.';
    case 'unavailable':
    case 'deadline-exceeded':
    case 'network-request-failed':
      return 'Koneksi ke Firebase bermasalah. Periksa internet lalu coba lagi.';
    default:
      return 'Terjadi kesalahan saat menghubungi server. Silakan coba lagi.';
  }
}

/**
 * Menyimpan ulasan pasca-praktikum beserta hasil analisis sentimen.
 * Teks ulasan dianalisis lewat `analyzeReviewSentiment()` yang otomatis
 * memakai fallback bila model lokal gagal.
 */
export async function submitReview(input: SubmitReviewInput): Promise<ReviewMutationResult> {
  const comment = input.comment.trim();

  if (!input.sessionId) {
    return { ok: false, reason: 'Pilih sesi praktikum terlebih dahulu.' };
  }
  if (!input.studentId) {
    return { ok: false, reason: 'Identitas praktikan belum dipilih.' };
  }
  if (comment.length < MIN_COMMENT_LENGTH) {
    return { ok: false, reason: `Ulasan minimal ${MIN_COMMENT_LENGTH} karakter.` };
  }

  const user = auth.currentUser;
  if (!user) {
    return { ok: false, reason: 'Sesi login berakhir. Masuk kembali untuk menulis ulasan.' };
  }
  if (user.uid !== input.studentId) {
    return { ok: false, reason: 'Identitas ulasan tidak cocok dengan akun yang sedang masuk.' };
  }

  const { sentiment, source } = await analyzeReviewSentiment(comment);
  const payload = {
    sessionId: input.sessionId,
    studentId: user.uid,
    studentName: input.studentName,
    comment,
    sentiment,
    sentimentSource: source,
    createdAt: new Date().toISOString(),
  };

  try {
    const reference = doc(db, REVIEWS_COLLECTION, getReviewId(input.sessionId, user.uid));
    await setDoc(reference, payload);
    return { ok: true, review: { id: reference.id, ...payload } };
  } catch (error) {
    return { ok: false, reason: getReviewErrorMessage(error) };
  }
}

/**
 * Berlangganan ulasan secara realtime lewat `onSnapshot`.
 * Asisten memakai `{}` untuk membaca semua ulasan, praktikan mengirim
 * `{ studentId }` agar query-nya sesuai Firestore security rules.
 */
export function subscribeReviews(
  scope: ReviewSubscriptionScope,
  onReviews: (reviews: Review[]) => void,
  onError?: (message: string) => void,
): () => void {
  const reviewsQuery = scope.studentId
    ? query(collection(db, REVIEWS_COLLECTION), where('studentId', '==', scope.studentId))
    : query(collection(db, REVIEWS_COLLECTION));

  return onSnapshot(
    reviewsQuery,
    (snapshot) => {
      const reviews = snapshot.docs
        .map((item) => toReview(item.id, item.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onReviews(reviews);
    },
    (error) => {
      onError?.(getReviewErrorMessage(error));
    },
  );
}
