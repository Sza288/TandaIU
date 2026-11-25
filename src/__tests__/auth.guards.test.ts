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
          profile: { ...praktikanSession.profile, role: 'asisten' },
        },
        '/auth/register',
      ),
    ).toBe('/assistant');
  });

  it('returns unauthenticated private-route requests to the landing without redirecting public routes', () => {
    expect(getAuthNavigationTarget({ status: 'unauthenticated' }, '/schedule')).toBe('/');
    expect(getAuthNavigationTarget({ status: 'unauthenticated' }, '/')).toBeNull();
  });

  it('preserves a schedule detail deep link through login without changing its session ID', () => {
    const deepLink = '/schedule/session-42';
    const loginTarget = getAuthNavigationTarget(
      { status: 'unauthenticated' },
      deepLink,
    );
    expect(loginTarget).toBe('/auth/login?returnTo=%2Fschedule%2Fsession-42');
    expect(
      getAuthNavigationTarget(praktikanSession, '/auth/login', deepLink),
    ).toBe(deepLink);
  });

  it('preserves an attendance deep link and its session ID through login', () => {
    const deepLink = '/praktikan/attendance?sessionId=session-42';
    const loginTarget = getAuthNavigationTarget(
      { status: 'unauthenticated' },
      '/praktikan/attendance',
      deepLink,
    );
    expect(loginTarget).toBe(
      '/auth/login?returnTo=%2Fpraktikan%2Fattendance%3FsessionId%3Dsession-42',
    );
    expect(
      getAuthNavigationTarget(praktikanSession, '/auth/login', deepLink),
    ).toBe(deepLink);
  });

  it('uses the role dashboard for ordinary login and rejects unsafe continuation routes', () => {
    expect(getAuthNavigationTarget(praktikanSession, '/auth/login')).toBe('/praktikan');
    expect(
      getAuthNavigationTarget(
        {
          status: 'authenticated',
          profile: { ...praktikanSession.profile, role: 'asisten' },
        },
        '/auth/login',
      ),
    ).toBe('/assistant');
    expect(
      getAuthNavigationTarget(praktikanSession, '/auth/login', '/assistant'),
    ).toBe('/praktikan');
    expect(
      getAuthNavigationTarget(
        { status: 'unauthenticated' },
        '/schedule/session-42/extra',
      ),
    ).toBe('/');
  });

  it('drops a session continuation on logout so the next login starts normally', () => {
    expect(
      getAuthNavigationTarget(
        { status: 'unauthenticated' },
        '/schedule/session-42',
        undefined,
        'authenticated',
      ),
    ).toBe('/');
    expect(getAuthNavigationTarget(praktikanSession, '/auth/login')).toBe('/praktikan');
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
    expect(getDashboardPath('asisten')).toBe('/assistant');
  });

  it('keeps the guard loading until the auth check finishes', () => {
    expect(getGuardDecision({ status: 'loading' })).toBe('loading');
  });

  it('rejects users who are not signed in', () => {
    expect(getGuardDecision({ status: 'unauthenticated' })).toBe('login');
  });

  it('rejects a role that is not allowed on the route', () => {
    expect(getGuardDecision(praktikanSession, ['asisten'])).toBe('forbidden');
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
