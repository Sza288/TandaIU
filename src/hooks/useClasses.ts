import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { db } from '../lib/firebase';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import { COLLECTIONS, type ClassDoc } from '../types/praktikum';

export type ClassesFilter = {
  courseId?: string;
  classId?: string;
  classIds?: string[];
};

const IN_QUERY_LIMIT = 30;
const EMPTY_CLASSES: ClassDoc[] = [];

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
  const classId = filter?.classId;
  const classIdsKey = (filter?.classIds ?? []).join('|');
  const classIds = useMemo(
    () => (classIdsKey ? classIdsKey.split('|') : []),
    [classIdsKey],
  );
  const authSession = useAuthSession();
  const assistant = authSession?.status === 'authenticated' && authSession.profile.role === 'asisten'
    ? authSession.profile
    : null;
  const assistantUid = assistant?.uid ?? '';
  const assistantSemesterParity = assistant?.assistantSemesterParity;
  const praktikan = authSession?.status === 'authenticated' && authSession.profile.role === 'praktikan'
    ? authSession.profile
    : null;
  const praktikanUid = praktikan?.uid ?? '';
  const assignmentMissing = Boolean(assistant && !assistantSemesterParity);
  const allowedClassIds = useMemo(
    () => classIds.filter(Boolean).slice(0, IN_QUERY_LIMIT),
    [classIds],
  );
  const noQueryPossible = Boolean(
    praktikanUid && !assistantUid && !classId && allowedClassIds.length === 0,
  );
  const filterKey = `${courseId ?? ''}::${classId ?? ''}::${assistantUid}::${assistantSemesterParity ?? ''}::${praktikanUid}::${classIdsKey}`;
  const [dataState, setData] = useState<ClassDoc[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const data = noQueryPossible ? EMPTY_CLASSES : dataState;
  const loading = !assignmentMissing && !noQueryPossible && resolvedKey !== filterKey;
  const error = assignmentMissing
    ? 'Penugasan semester akun Asprak belum dikonfigurasi.'
    : noQueryPossible
      ? null
      : resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    if (assignmentMissing || noQueryPossible) return undefined;

    const constraints = [];
    if (assistantUid) {
      constraints.push(where('assistantUid', '==', assistantUid));
      constraints.push(where('semesterParity', '==', assistantSemesterParity));
      if (classId) constraints.push(where('classId', '==', classId));
      else if (allowedClassIds.length > 0) {
        constraints.push(where('classId', 'in', allowedClassIds));
      }
    } else if (praktikanUid) {
      if (classId) constraints.push(where('classId', '==', classId));
      else constraints.push(where('classId', 'in', allowedClassIds));
    } else if (classId) {
      constraints.push(where('classId', '==', classId));
    } else if (allowedClassIds.length > 0) {
      constraints.push(where('classId', 'in', allowedClassIds));
    }

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.classes), ...constraints),
      (snapshot) => {
        const nextData = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<ClassDoc, 'id'>),
          }))
          .filter((item) =>
            (!classId || item.id === classId)
            && (allowedClassIds.length === 0 || allowedClassIds.includes(item.id))
            && (!courseId || item.courseId === courseId));

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
  }, [
    allowedClassIds,
    assignmentMissing,
    assistantUid,
    assistantSemesterParity,
    classId,
    courseId,
    filterKey,
    noQueryPossible,
    praktikanUid,
  ]);

  return { data: assignmentMissing ? EMPTY_CLASSES : data, loading, error };
}
