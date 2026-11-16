import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../lib/firebase';
import type { SessionStatus } from '../types';
import { COLLECTIONS, type SessionDoc } from '../types/praktikum';

export type SessionsFilter = {
  courseId?: string;
  status?: SessionStatus;
};

export type UseSessionsResult = {
  data: SessionDoc[];
  loading: boolean;
  error: string | null;
};

function mapLoadError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code.includes('permission-denied')) {
    return 'Anda tidak memiliki izin melihat data ini';
  }
  if (code.includes('unavailable')) {
    return 'Koneksi bermasalah';
  }
  return 'Terjadi kesalahan saat memuat data.';
}

export function useSessions(filter?: SessionsFilter): UseSessionsResult {
  const courseId = filter?.courseId;
  const status = filter?.status;
  const filterKey = `${courseId ?? ''}::${status ?? ''}`;
  const [data, setData] = useState<SessionDoc[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const loading = resolvedKey !== filterKey;
  const error = resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.sessions),
      (snapshot) => {
        const nextData = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<SessionDoc, 'id'>),
          }))
          .filter(
            (item) =>
              (!courseId || item.courseId === courseId) &&
              (!status || item.status === status),
          )
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

        setData(nextData);
        setErrorState(null);
        setResolvedKey(filterKey);
      },
      (snapshotError) => {
        setErrorState(mapLoadError(snapshotError));
        setResolvedKey(filterKey);
      },
    );

    return unsubscribe;
  }, [courseId, status, filterKey]);

  return { data, loading, error };
}
