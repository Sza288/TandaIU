export const USER_ROLES = ['assistant', 'praktikan'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type RegistrationRole = 'praktikan' | 'asisten';

export type AuthProfile = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentCode?: string;
};

export type AuthSessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; profile: AuthProfile }
  | {
      status: 'error';
      message: string;
      code?: string;
      googleRegistrationAllowed?: boolean;
    };

export type GuardDecision = 'loading' | 'allow' | 'login' | 'forbidden' | 'error';

export function getDashboardPath(role: UserRole): '/assistant' | '/praktikan' {
  return role === 'assistant' ? '/assistant' : '/praktikan';
}

export function getAuthNavigationTarget(
  state: AuthSessionState,
  pathname: string,
): '/' | '/assistant' | '/praktikan' | null {
  const isPublicPath =
    pathname === '/' || pathname === '/auth/login' || pathname === '/auth/register';

  if (state.status === 'authenticated' && (isPublicPath || pathname === '/home')) {
    return getDashboardPath(state.profile.role);
  }
  if (state.status === 'unauthenticated' && !isPublicPath) {
    return '/';
  }
  return null;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'assistant' || value === 'praktikan';
}

export function getGuardDecision(
  state: AuthSessionState,
  allowedRoles?: readonly UserRole[],
): GuardDecision {
  if (state.status === 'loading') {
    return 'loading';
  }
  if (state.status === 'unauthenticated') {
    return 'login';
  }
  if (state.status === 'error') {
    return 'error';
  }
  if (allowedRoles && !allowedRoles.includes(state.profile.role)) {
    return 'forbidden';
  }
  return 'allow';
}
