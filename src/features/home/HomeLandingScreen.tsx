import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAttendance } from '../../state/AttendanceContext';

export default function HomeLandingScreen() {
  const { activeRole } = useAttendance();

  useEffect(() => {
    if (activeRole === 'asisten') {
      router.replace('/assistant');
    } else if (activeRole === 'praktikan') {
      router.replace('/praktikan');
    } else {
      router.replace('/');
    }
  }, [activeRole]);

  return null;
}
