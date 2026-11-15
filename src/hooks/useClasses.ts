import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../lib/firebase';
import { COLLECTIONS, type ClassDoc } from '../types/praktikum';

export type ClassesFilter = {
  courseId?: string;
};

export type UseClassesResult = {
  data: ClassDoc[];
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

export function useClasses(filter?: ClassesFilter): UseClassesResult {
  const courseId = filter?.courseId;
  const filterKey = courseId ?? '';
  const [data, setData] = useState<ClassDoc[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const loading = resolvedKey !== filterKey;
  const error = resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.classes),
      (snapshot) => {
        const nextData = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<ClassDoc, 'id'>),
          }))
          .filter((item) => !courseId || item.courseId === courseId);

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
  }, [courseId, filterKey]);

  return { data, loading, error };
}
