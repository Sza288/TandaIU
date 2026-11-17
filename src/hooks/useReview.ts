import { useEffect, useState } from 'react';
import { Review } from '../features/review/review.types';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import { subscribeReviews } from '../services/reviewService';

type ReviewSnapshot = {
  key: string | null;
  reviews: Review[];
};

/**
 * Berlangganan ulasan secara realtime. Asisten menerima seluruh ulasan,
 * praktikan hanya menerima ulasan miliknya sendiri (sesuai security rules).
 */
export function useReviews(): Review[] {
  const session = useAuthSession();
  const profile = session?.status === 'authenticated' ? session.profile : null;
  const uid = profile?.uid ?? null;
  const role = profile?.role ?? null;
  const key = uid && role ? `${role}:${uid}` : null;
  const [snapshot, setSnapshot] = useState<ReviewSnapshot>({ key: null, reviews: [] });

  useEffect(() => {
    if (!key || !uid || !role) return;

    const scope = role === 'asisten' ? {} : { studentId: uid };
    return subscribeReviews(
      scope,
      (next) => setSnapshot({ key, reviews: next }),
      (message) => {
        console.warn('[review] Gagal memuat ulasan:', message);
        setSnapshot({ key, reviews: [] });
      },
    );
  }, [key, role, uid]);

  return snapshot.key === key ? snapshot.reviews : [];
}

/** Memantau ulasan milik praktikan aktif untuk satu sesi. */
export function useReview(sessionId: string | null): Review | undefined {
  const reviews = useReviews();
  if (!sessionId) return undefined;
  return reviews.find((review) => review.sessionId === sessionId);
}
