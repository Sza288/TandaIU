import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { AuthProfile } from '../auth/authTypes';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useLaboratories } from '../../hooks/useLaboratories';
import { useSchedules } from '../../hooks/useSchedules';
import { useSessions } from '../../hooks/useSessions';
import { processLaboratoryActivities } from '../../utils/laboratoryActivities';

export function useLaboratoryMapData(profile: AuthProfile) {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => setNow(Date.now()), 5_000);
      return () => clearInterval(timer);
    }, []),
  );

  const laboratories = useLaboratories();
  const sessions = useSessions();
  const enrollments = useEnrollments(
    profile.role === 'praktikan' ? { praktikanId: profile.uid } : undefined,
  );
  const classIds = useMemo(
    () => enrollments.data.map((enrollment) => enrollment.classId),
    [enrollments.data],
  );
  const schedules = useSchedules(
    profile.role === 'praktikan' ? { classIds } : undefined,
  );

  const activitiesByLaboratory = useMemo(() => {
    return new Map(
      laboratories.data.map((laboratory) => [
        laboratory.id,
        processLaboratoryActivities(
          laboratory.id,
          schedules.data,
          sessions.data,
          now,
        ),
      ]),
    );
  }, [laboratories.data, schedules.data, sessions.data, now]);

  return {
    laboratories,
    sessions,
    schedules,
    enrollments,
    activitiesByLaboratory,
    activitiesLoading: sessions.loading || enrollments.loading,
    activitiesError: sessions.error ?? enrollments.error,
    scheduleError: schedules.error,
  };
}
