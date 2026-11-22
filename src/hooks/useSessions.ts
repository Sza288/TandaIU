import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { db } from '../lib/firebase';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import { subscribeToEnrollments } from '../services/enrollmentService';
import type { SessionStatus } from '../types';
import { COLLECTIONS, type SessionDoc } from '../types/praktikum';
import { firestoreDateToIso } from '../utils/firestoreDate';

export type SessionsFilter = {
  courseId?: string;
  status?: SessionStatus;
};

export type UseSessionsResult = {
  data: SessionDoc[];
  loading: boolean;
  error: string | null;
  retry: () => void;
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
  const filterKey = `${courseId ?? ''}::${status ?? ''}::${assistantUid}::${assistantSemesterParity ?? ''}::${praktikanUid}`;
  const [data, setData] = useState<SessionDoc[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loading = !assignmentMissing && resolvedKey !== filterKey;
  const error = assignmentMissing
    ? 'Penugasan semester akun Asprak belum dikonfigurasi.'
    : resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    if (assignmentMissing) return undefined;
    if (praktikanUid) {
      let sessionUnsubscribers: (() => void)[] = [];
      const unsubscribeEnrollments = subscribeToEnrollments(
        { praktikanId: praktikanUid },
        (enrollments) => {
          sessionUnsubscribers.forEach((unsubscribe) => unsubscribe());
          sessionUnsubscribers = enrollments.map((enrollment) => onSnapshot(
            query(collection(db, COLLECTIONS.sessions), where('classId', '==', enrollment.classId)),
            (snapshot) => {
              const current = new Map<string, SessionDoc>();
              snapshot.docs.forEach((document) => {
                const session = document.data() as Omit<SessionDoc, 'id'>;
                current.set(document.id, {
                  ...session,
                  id: document.id,
                  startsAt: firestoreDateToIso(session.startsAt),
                  endsAt: firestoreDateToIso(session.endsAt),
                });
              });
              setData((previous) => {
                const next = new Map(previous.map((item) => [item.id, item]));
                snapshot.docs.forEach((document) => next.set(document.id, current.get(document.id)!));
                const enrolledIds = new Set(enrollments.map((item) => item.classId));
                return [...next.values()]
                  .filter((item) => enrolledIds.has(item.classId))
                  .filter((item) => (!courseId || item.courseId === courseId)
                    && (!status || item.status === status))
                  .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
              });
              setErrorState(null);
              setResolvedKey(filterKey);
            },
            (snapshotError) => {
              setErrorState(mapLoadError(snapshotError));
              setResolvedKey(filterKey);
            },
          ));
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
        sessionUnsubscribers.forEach((unsubscribe) => unsubscribe());
      };
    }
    if (!assistantUid) return undefined;
    const constraints = [];
    if (assistantUid) {
      constraints.push(where('assistantUid', '==', assistantUid));
      constraints.push(where('semesterParity', '==', assistantSemesterParity));
    }
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.sessions), ...constraints),
      (snapshot) => {
        const nextData = snapshot.docs
          .map((document) => {
            const session = document.data() as Omit<SessionDoc, 'id'>;
            return {
              ...session,
              id: document.id,
              startsAt: firestoreDateToIso(session.startsAt),
              endsAt: firestoreDateToIso(session.endsAt),
            };
          })
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
  }, [assignmentMissing, assistantUid, assistantSemesterParity, praktikanUid, courseId, status, filterKey, reloadKey]);

  const retry = useCallback(() => {
    setData([]);
    setErrorState(null);
    setResolvedKey(null);
    setReloadKey((value) => value + 1);
  }, []);

  return { data: assignmentMissing || resolvedKey !== filterKey ? [] : data, loading, error, retry };
}
