import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../lib/firebase';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import { COLLECTIONS, type ScheduleDoc } from '../types/praktikum';
import { subscribeToEnrollments } from '../services/enrollmentService';

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
  const praktikan = authSession?.status === 'authenticated' && authSession.profile.role === 'praktikan'
    ? authSession.profile
    : null;
  const praktikanUid = praktikan?.uid ?? '';
  const assignmentMissing = Boolean(assistant && !assistantSemesterParity);
  const filterKey = `${classId ?? ''}::${assistantUid}::${assistantSemesterParity ?? ''}::${praktikanUid}`;
  const [data, setData] = useState<ScheduleDoc[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const loading = !assignmentMissing && resolvedKey !== filterKey;
  const error = assignmentMissing
    ? 'Penugasan semester akun Asprak belum dikonfigurasi.'
    : resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    if (assignmentMissing) return undefined;
    if (praktikanUid) {
      let scheduleUnsubscribers: (() => void)[] = [];
      const unsubscribeEnrollments = subscribeToEnrollments(
        { praktikanId: praktikanUid },
        (enrollments) => {
          scheduleUnsubscribers.forEach((unsubscribe) => unsubscribe());
          scheduleUnsubscribers = enrollments.map((enrollment) =>
            onSnapshot(
              query(
                collection(db, COLLECTIONS.schedules),
                where('classId', '==', enrollment.classId),
              ),
              (snapshot) => {
                setData((previous) => {
                  const next = new Map(previous.map((item) => [item.id, item]));
                  snapshot.docs.forEach((document) => {
                    next.set(document.id, {
                      id: document.id,
                      ...(document.data() as Omit<ScheduleDoc, 'id'>),
                    });
                  });
                  const enrolledIds = new Set(enrollments.map((item) => item.classId));
                  return [...next.values()]
                    .filter((item) => enrolledIds.has(item.classId))
                    .filter((item) => !classId || item.classId === classId);
                });
                setErrorState(null);
                setResolvedKey(filterKey);
              },
              (snapshotError) => {
                setErrorState(mapLoadError(snapshotError));
                setResolvedKey(filterKey);
              },
            ),
          );
          if (enrollments.length === 0) {
            setData([]);
            setErrorState(null);
            setResolvedKey(filterKey);
          }
        },
        (message) => {
          setData([]);
          setErrorState(message);
          setResolvedKey(filterKey);
        },
      );
      return () => {
        unsubscribeEnrollments();
        scheduleUnsubscribers.forEach((unsubscribe) => unsubscribe());
      };
    }
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
  }, [assignmentMissing, assistantUid, assistantSemesterParity, praktikanUid, classId, filterKey]);

  return { data: assignmentMissing ? [] : data, loading, error };
}
