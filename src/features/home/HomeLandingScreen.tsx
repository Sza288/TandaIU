import { useEffect } from 'react';
import { router } from 'expo-router';
import { getDashboardPath } from '../auth/authTypes';
import { useAuthSession } from '../auth/AuthSessionContext';

export default function HomeLandingScreen() {
  const session = useAuthSession();

  useEffect(() => {
    if (!session || session.status === 'loading') return;
    if (session.status === 'authenticated') {
      router.replace(getDashboardPath(session.profile.role));
      return;
    }
    router.replace('/');
  }, [session]);

  return null;
}
