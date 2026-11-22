export const USER_ROLES = ['asisten', 'praktikan'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type RegistrationRole = 'praktikan' | 'asisten';
export type AssistantSemesterParity = 'ganjil' | 'genap';

export type AuthProfile = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentCode?: string;
  assistantSemesterParity?: AssistantSemesterParity;
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
  return role === 'asisten' ? '/assistant' : '/praktikan';
}

export function getAuthNavigationTarget(
  state: AuthSessionState,
  pathname: string,
  returnTo?: string,
  previousStatus?: AuthSessionState['status'],
): string | null {
  const isPublicPath =
    pathname === '/' || pathname === '/auth/login' || pathname === '/auth/register';

  if (state.status === 'authenticated' && (isPublicPath || pathname === '/home')) {
    const sessionPath = normalizeScheduleDetailPath(returnTo);
    if (pathname === '/auth/login' && sessionPath) return sessionPath;
    return getDashboardPath(state.profile.role);
  }
  if (state.status === 'unauthenticated' && previousStatus === 'authenticated') {
    return '/';
  }
  if (state.status === 'unauthenticated' && !isPublicPath) {
    const sessionPath = normalizeScheduleDetailPath(pathname);
    if (sessionPath) {
      return `/auth/login?returnTo=${encodeURIComponent(sessionPath)}`;
    }
    return '/';
  }
  return null;
}

function normalizeScheduleDetailPath(path: string | undefined): string | null {
  if (!path || !path.startsWith('/schedule/')) return null;
  const segments = path.split('/');
  if (segments.length !== 3 || !segments[2]) return null;

  try {
    const sessionId = decodeURIComponent(segments[2]);
    if (!sessionId || sessionId.includes('/')) return null;
    return `/schedule/${encodeURIComponent(sessionId)}`;
  } catch {
    return null;
  }
}

// Dokumen lama sempat menyimpan role 'assistant'; nilai itu tetap diterima saat membaca.
export function toUserRole(value: unknown): UserRole | null {
  if (value === 'asisten' || value === 'assistant') return 'asisten';
  if (value === 'praktikan') return 'praktikan';
  return null;
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
