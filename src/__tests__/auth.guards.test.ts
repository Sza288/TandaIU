import {
  getAuthNavigationTarget,
  getDashboardPath,
  getGuardDecision,
  type AuthSessionState,
} from '../features/auth/authTypes';

const praktikanSession: AuthSessionState = {
  status: 'authenticated',
  profile: {
    uid: 'uid-1',
    name: 'Ayu Pratiwi',
    email: 'ayu@example.com',
    role: 'praktikan',
    studentCode: '24060124120001',
  },
};

describe('protected route access decisions', () => {
  it('routes authenticated users from public and legacy home routes using their profile role', () => {
    expect(getAuthNavigationTarget(praktikanSession, '/')).toBe('/praktikan');
    expect(getAuthNavigationTarget(praktikanSession, '/auth/login')).toBe('/praktikan');
    expect(getAuthNavigationTarget(praktikanSession, '/home')).toBe('/praktikan');
    expect(
      getAuthNavigationTarget(
        {
          status: 'authenticated',
          profile: { ...praktikanSession.profile, role: 'assistant' },
        },
        '/auth/register',
      ),
    ).toBe('/assistant');
  });

  it('returns unauthenticated private-route requests to the landing without redirecting public routes', () => {
    expect(getAuthNavigationTarget({ status: 'unauthenticated' }, '/schedule')).toBe('/');
    expect(getAuthNavigationTarget({ status: 'unauthenticated' }, '/')).toBeNull();
  });

  it('does not redirect authenticated users between private routes or hide profile errors', () => {
    expect(getAuthNavigationTarget(praktikanSession, '/schedule')).toBeNull();
    expect(
      getAuthNavigationTarget(
        { status: 'error', message: 'Profil tidak tersedia.' },
        '/schedule',
      ),
    ).toBeNull();
  });

  it('maps each verified role to its existing dashboard route', () => {
    expect(getDashboardPath('praktikan')).toBe('/praktikan');
    expect(getDashboardPath('assistant')).toBe('/assistant');
  });

  it('keeps the guard loading until the auth check finishes', () => {
    expect(getGuardDecision({ status: 'loading' })).toBe('loading');
  });

  it('rejects users who are not signed in', () => {
    expect(getGuardDecision({ status: 'unauthenticated' })).toBe('login');
  });

  it('rejects a role that is not allowed on the route', () => {
    expect(getGuardDecision(praktikanSession, ['assistant'])).toBe('forbidden');
  });

  it('allows a verified profile for its permitted role', () => {
    expect(getGuardDecision(praktikanSession, ['praktikan'])).toBe('allow');
  });

  it('denies access when profile lookup failed', () => {
    expect(
      getGuardDecision({ status: 'error', message: 'Profil tidak dapat dimuat.' }),
    ).toBe('error');
  });
});
