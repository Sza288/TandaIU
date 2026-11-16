import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../lib/firebase';
import { COLLECTIONS, type ScheduleDoc } from '../types/praktikum';

export type SchedulesFilter = {
  classId?: string;
};

export type UseSchedulesResult = {
  data: ScheduleDoc[];
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

export function useSchedules(filter?: SchedulesFilter): UseSchedulesResult {
  const classId = filter?.classId;
  const filterKey = classId ?? '';
  const [data, setData] = useState<ScheduleDoc[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const loading = resolvedKey !== filterKey;
  const error = resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.schedules),
      (snapshot) => {
        const nextData = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<ScheduleDoc, 'id'>),
          }))
          .filter((item) => !classId || item.classId === classId);

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
  }, [classId, filterKey]);

  return { data, loading, error };
}
