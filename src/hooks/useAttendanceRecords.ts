import { useCallback, useEffect, useState } from 'react';

import {
  subscribeToAttendance,
  subscribeToPraktikanAttendance,
  type AttendanceListener,
  type AttendanceRecord,
  type ListenerErrorHandler,
} from '../services/attendanceService';

type AttendanceListenerState = {
  data: AttendanceRecord[];
  loading: boolean;
  error: string | null;
  retry: () => void;
};

const EMPTY_ATTENDANCE: AttendanceRecord[] = [];

function useAttendanceSubscription(
  key: string | null,
  subscribe: (
    onData: (records: AttendanceRecord[]) => void,
    onError: (message: string) => void,
  ) => () => void,
): AttendanceListenerState {
  const [dataState, setData] = useState<AttendanceRecord[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const data = key ? dataState : EMPTY_ATTENDANCE;
  const loading = Boolean(key) && resolvedKey !== `${key}::${reloadKey}`;
  const error = Boolean(key) && resolvedKey === `${key}::${reloadKey}` ? errorState : null;

  useEffect(() => {
    if (!key) {
      return undefined;
    }

    const activeKey = `${key}::${reloadKey}`;
    const unsubscribe = subscribe(
      (records) => {
        setData(records);
        setErrorState(null);
        setResolvedKey(activeKey);
      },
      (message) => {
        setData([]);
        setErrorState(message);
        setResolvedKey(activeKey);
      },
    );

    return unsubscribe;
  }, [key, reloadKey, subscribe]);

  const retry = useCallback(() => {
    setData([]);
    setErrorState(null);
    setResolvedKey(null);
    setReloadKey((value) => value + 1);
  }, []);

  return { data, loading, error, retry };
}

export function usePraktikanAttendance(praktikanId?: string | null): AttendanceListenerState {
  const normalizedId = praktikanId?.trim() ?? '';
  const subscribe = useCallback(
    (
      onData: (records: AttendanceRecord[]) => void,
      onError: (message: string) => void,
    ) => subscribeToPraktikanAttendance(normalizedId, onData, onError),
    [normalizedId],
  );

  return useAttendanceSubscription(normalizedId || null, subscribe);
}

/**
 * Presensi untuk sekumpulan sesi (misalnya semua sesi satu kelas) dalam satu
 * listener gabungan. Setiap sesi tetap dibaca lewat query `sessionId ==`
 * sendiri-sendiri karena Rules mengevaluasi kepemilikan per sesi.
 */
export function useSessionsAttendance(
  sessionIds: readonly string[],
): AttendanceListenerState {
  const key = sessionIds.join('|');
  const subscribe = useCallback(
    (onData: AttendanceListener, onError: ListenerErrorHandler) => {
      const ids = key ? key.split('|') : [];
      if (ids.length === 0) {
        onData([]);
        return () => undefined;
      }

      const bySession = new Map<string, AttendanceRecord[]>();
      const emit = () => onData([...bySession.values()].flat());

      const unsubscribers = ids.map((sessionId) =>
        subscribeToAttendance(
          sessionId,
          (records) => {
            bySession.set(sessionId, records);
            emit();
          },
          onError,
        ),
      );

      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    },
    [key],
  );

  return useAttendanceSubscription(key || null, subscribe);
}

export function useSessionAttendance(
  sessionId?: string | null,
  praktikanId?: string | null,
): AttendanceListenerState {
  const normalizedId = sessionId?.trim() ?? '';
  const normalizedPraktikanId = praktikanId?.trim() ?? '';
  const key = normalizedId ? `${normalizedId}::${normalizedPraktikanId}` : null;
  const subscribe = useCallback(
    (
      onData: (records: AttendanceRecord[]) => void,
      onError: (message: string) => void,
    ) => subscribeToAttendance(
      normalizedId,
      onData,
      onError,
      normalizedPraktikanId || undefined,
    ),
    [normalizedId, normalizedPraktikanId],
  );

  return useAttendanceSubscription(key, subscribe);
}
