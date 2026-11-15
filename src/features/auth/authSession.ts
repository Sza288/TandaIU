import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { getAuthErrorMessage, getUserProfile } from '../../services/authService';
import type { AuthSessionState } from './authTypes';

export type AuthSessionSubscription = {
  refresh: () => Promise<void>;
  unsubscribe: () => void;
};

export function subscribeToAuthSession(
  onChange: (state: AuthSessionState) => void,
): AuthSessionSubscription {
  let active = true;
  let revision = 0;

  const loadProfile = async (user: User, requestRevision: number): Promise<void> => {
    onChange({ status: 'loading' });
    try {
      const profile = await getUserProfile(user.uid);
      if (active && requestRevision === revision) {
        onChange({ status: 'authenticated', profile });
      }
    } catch (error) {
      if (active && requestRevision === revision) {
        const code =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          typeof error.code === 'string'
            ? error.code
            : undefined;
        const googleRegistrationAllowed =
          code === 'profile-not-found' &&
          user.providerData.some((provider) => provider.providerId === 'google.com');
        onChange({
          status: 'error',
          message: getAuthErrorMessage(error),
          ...(code ? { code } : {}),
          ...(googleRegistrationAllowed ? { googleRegistrationAllowed: true } : {}),
        });
      }
      throw error;
    }
  };

  const refresh = async (): Promise<void> => {
    const requestRevision = ++revision;
    const user = auth.currentUser;
    if (!user) {
      onChange({ status: 'unauthenticated' });
      return;
    }
    await loadProfile(user, requestRevision);
  };

  const unsubscribe = onAuthStateChanged(
    auth,
    (firebaseUser: User | null) => {
      const requestRevision = ++revision;
      if (!firebaseUser) {
        onChange({ status: 'unauthenticated' });
        return;
      }

      void loadProfile(firebaseUser, requestRevision).catch(() => undefined);
    },
    (error: Error) => {
      if (active) {
        onChange({ status: 'error', message: getAuthErrorMessage(error) });
      }
    },
  );

  return {
    refresh,
    unsubscribe: () => {
      active = false;
      revision += 1;
      unsubscribe();
    },
  };
}
