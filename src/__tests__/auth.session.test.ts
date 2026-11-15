import { onAuthStateChanged, type User } from 'firebase/auth';
import { getUserProfile } from '../services/authService';
import { subscribeToAuthSession } from '../features/auth/authSession';
import type { AuthProfile } from '../features/auth/authTypes';

jest.mock('../lib/firebase', () => ({
  auth: {},
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock('../services/authService', () => ({
  getAuthErrorMessage: jest.fn(() => 'Profil tidak dapat dimuat.'),
  getUserProfile: jest.fn(),
}));

const profile: AuthProfile = {
  uid: 'uid-1',
  name: 'Ayu Pratiwi',
  email: 'ayu@example.com',
  role: 'praktikan',
  studentCode: '24060124120001',
};

const unsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it('cleans up the auth listener when the subscription ends', () => {
  jest.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);

  const subscription = subscribeToAuthSession(jest.fn());
  subscription.unsubscribe();

  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('refreshes the profile after account registration', async () => {
  const { auth } = jest.requireMock('../lib/firebase') as {
    auth: { currentUser?: User };
  };
  auth.currentUser = { uid: 'uid-1' } as User;
  jest.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);
  jest.mocked(getUserProfile).mockResolvedValue(profile);
  const onChange = jest.fn();

  const subscription = subscribeToAuthSession(onChange);
  await subscription.refresh();

  expect(onChange).toHaveBeenLastCalledWith({ status: 'authenticated', profile });
});

it('does not publish a profile result after the listener has been cleaned up', async () => {
  let resolveProfile: ((value: AuthProfile) => void) | undefined;
  jest.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
    const next = typeof observer === 'function' ? observer : observer.next;
    next({ uid: 'uid-1' } as User);
    return unsubscribe;
  });
  jest.mocked(getUserProfile).mockImplementation(
    () =>
      new Promise<AuthProfile>((resolve) => {
        resolveProfile = resolve;
      }),
  );
  const onChange = jest.fn();

  const subscription = subscribeToAuthSession(onChange);
  subscription.unsubscribe();
  resolveProfile?.(profile);
  await Promise.resolve();

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ status: 'loading' });
});

it('does not grant access when loading a signed-in user profile fails', async () => {
  jest.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
    const next = typeof observer === 'function' ? observer : observer.next;
    next({ uid: 'uid-1' } as User);
    return unsubscribe;
  });
  jest.mocked(getUserProfile).mockRejectedValue(new Error('read failed'));
  const onChange = jest.fn();

  subscribeToAuthSession(onChange);
  await Promise.resolve();
  await Promise.resolve();

  expect(onChange).toHaveBeenLastCalledWith({
    status: 'error',
    message: 'Profil tidak dapat dimuat.',
  });
});

it('allows a Google-authenticated user without a profile to complete Google registration', async () => {
  jest.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
    const next = typeof observer === 'function' ? observer : observer.next;
    next({ uid: 'uid-1', providerData: [{ providerId: 'google.com' }] } as User);
    return unsubscribe;
  });
  jest.mocked(getUserProfile).mockRejectedValue(
    Object.assign(new Error('missing profile'), { code: 'profile-not-found' }),
  );
  const onChange = jest.fn();

  subscribeToAuthSession(onChange);
  await Promise.resolve();
  await Promise.resolve();

  expect(onChange).toHaveBeenLastCalledWith({
    status: 'error',
    message: 'Profil tidak dapat dimuat.',
    code: 'profile-not-found',
    googleRegistrationAllowed: true,
  });
});

it('does not allow email accounts with missing profiles to self-register a role', async () => {
  jest.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
    const next = typeof observer === 'function' ? observer : observer.next;
    next({ uid: 'uid-1', providerData: [{ providerId: 'password' }] } as User);
    return unsubscribe;
  });
  jest.mocked(getUserProfile).mockRejectedValue(
    Object.assign(new Error('missing profile'), { code: 'profile-not-found' }),
  );
  const onChange = jest.fn();

  subscribeToAuthSession(onChange);
  await Promise.resolve();
  await Promise.resolve();

  expect(onChange).toHaveBeenLastCalledWith({
    status: 'error',
    message: 'Profil tidak dapat dimuat.',
    code: 'profile-not-found',
  });
});
