import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../lib/firebase';
import { useAuthSession } from '../features/auth/AuthSessionContext';
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
  const authSession = useAuthSession();
  const assistant = authSession?.status === 'authenticated' && authSession.profile.role === 'asisten'
    ? authSession.profile
    : null;
  const assistantUid = assistant?.uid ?? '';
  const assistantSemesterParity = assistant?.assistantSemesterParity;
  const assignmentMissing = Boolean(assistant && !assistantSemesterParity);
  const filterKey = `${classId ?? ''}::${assistantUid}::${assistantSemesterParity ?? ''}`;
  const [data, setData] = useState<ScheduleDoc[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const loading = !assignmentMissing && resolvedKey !== filterKey;
  const error = assignmentMissing
    ? 'Penugasan semester akun Asprak belum dikonfigurasi.'
    : resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    if (assignmentMissing) return undefined;
    const constraints = [];
    if (assistantUid) {
      constraints.push(where('assistantUid', '==', assistantUid));
      constraints.push(where('semesterParity', '==', assistantSemesterParity));
    }
    if (classId) constraints.push(where('classId', '==', classId));
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.schedules), ...constraints),
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
  }, [assignmentMissing, assistantUid, assistantSemesterParity, classId, filterKey]);

  return { data: assignmentMissing ? [] : data, loading, error };
}
