import type { AuthProfile } from '../auth/authTypes';

export type AuthenticatedPraktikanIdentity = {
  id: string;
  // Set only after an explicit account-to-enrollment mapping is agreed and available.
  localScheduleId?: string;
  name: string;
  studentCode?: string;
};

export function getAuthenticatedPraktikanIdentity(
  profile: AuthProfile | null | undefined,
): AuthenticatedPraktikanIdentity | null {
  if (!profile || profile.role !== 'praktikan') return null;

  return {
    id: profile.uid,
    name: profile.name,
    ...(profile.studentCode ? { studentCode: profile.studentCode } : {}),
  };
}
