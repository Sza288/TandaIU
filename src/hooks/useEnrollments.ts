import { useCallback, useEffect, useState } from 'react';

import {
  subscribeToEnrollments,
  type EnrollmentFilter,
  type EnrollmentRecord,
} from '../services/enrollmentService';

export type UseEnrollmentsResult = {
  data: EnrollmentRecord[];
  loading: boolean;
  error: string | null;
  retry: () => void;
};

const EMPTY_ENROLLMENTS: EnrollmentRecord[] = [];

export function useEnrollments(filter?: EnrollmentFilter): UseEnrollmentsResult {
  const praktikanId = filter?.praktikanId?.trim() ?? '';
  const classId = filter?.classId?.trim() ?? '';
  const filterKey = `${praktikanId}::${classId}`;
  const hasFilter = Boolean(praktikanId || classId);
  const [dataState, setData] = useState<EnrollmentRecord[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const data = hasFilter ? dataState : EMPTY_ENROLLMENTS;
  const loading = hasFilter && resolvedKey !== filterKey;
  const error = hasFilter && resolvedKey === filterKey ? errorState : null;

  useEffect(() => {
    if (!hasFilter) {
      return undefined;
    }

    const unsubscribe = subscribeToEnrollments(
      { praktikanId, classId },
      (records) => {
        setData(records);
        setErrorState(null);
        setResolvedKey(filterKey);
      },
      (message) => {
        setData([]);
        setErrorState(message);
        setResolvedKey(filterKey);
      },
    );

    return unsubscribe;
  }, [classId, filterKey, hasFilter, praktikanId, reloadKey]);

  const retry = useCallback(() => {
    setData([]);
    setErrorState(null);
    setResolvedKey(null);
    setReloadKey((value) => value + 1);
  }, []);

  return { data, loading, error, retry };
}
