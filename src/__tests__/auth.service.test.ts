import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import {
  AuthServiceError,
  getAuthErrorMessage,
  getUserProfile,
  isGoogleSignInAvailable,
  registerWithEmailAndPassword,
  registerGoogleProfile,
  sendPasswordReset,
  signInWithEmailAndPasswordForProfile,
  signInWithGoogleForProfile,
  signOut,
  validateRegistrationInput,
  validateGoogleProfileInput,
  type RegistrationInput,
} from '../services/authService';
import { removeCurrentDeviceToken } from '../services/notificationService';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null },
}));

jest.mock('../lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: Object.assign(
    jest.fn().mockImplementation(() => ({ providerId: 'google.com' })),
    { credential: jest.fn(() => ({ providerId: 'google.com', token: 'google-id-token' })) },
  ),
  createUserWithEmailAndPassword: jest.fn(),
  deleteUser: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  __esModule: true,
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(null),
  },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  runTransaction: jest.fn((_db, updateFunction) => updateFunction({
    get: (...args: unknown[]) => mockTransactionGet(...args),
    set: (...args: unknown[]) => mockTransactionSet(...args),
  })),
  setDoc: jest.fn(),
}));

jest.mock('../services/notificationService', () => ({
  removeCurrentDeviceToken: jest.fn(),
}));

const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();

const user = {
  uid: 'uid-1',
  email: 'ayu@example.com',
  displayName: 'Ayu Pratiwi',
  providerData: [{ providerId: 'google.com' }],
} as User;
const userCredential = {
  user,
} as Awaited<ReturnType<typeof createUserWithEmailAndPassword>>;
const documentReference = {} as ReturnType<typeof doc>;
const validProfile = {
  uid: 'uid-1',
  name: 'Ayu Pratiwi',
  email: 'ayu@example.com',
  role: 'praktikan',
  studentCode: '24060124120001',
};
const registrationInput: RegistrationInput = {
  name: ' Ayu Pratiwi ',
  email: ' ayu@example.com ',
  password: 'rahasia123',
  confirmPassword: 'rahasia123',
  studentCode: ' 24060124120001 ',
  role: 'praktikan',
};

function makeDocumentSnapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  } as Awaited<ReturnType<typeof getDoc>>;
}

function firebaseError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Constants, 'appOwnership', { configurable: true, value: null });
  jest.mocked(doc).mockReturnValue(documentReference);
  jest.mocked(setDoc).mockResolvedValue(undefined);
  jest.mocked(runTransaction).mockClear();
  mockTransactionGet.mockReset();
  mockTransactionSet.mockReset();
  mockTransactionGet.mockResolvedValue(makeDocumentSnapshot(null));
  Object.assign(auth, { currentUser: null });
  jest.mocked(deleteUser).mockResolvedValue(undefined);
  jest.mocked(firebaseSignOut).mockResolvedValue(undefined);
  jest.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
  jest.mocked(removeCurrentDeviceToken).mockResolvedValue({ ok: true });
});

describe('registration flow', () => {
  it('creates an auth account and stores only the contracted profile fields', async () => {
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValue(userCredential);

    await expect(registerWithEmailAndPassword(registrationInput)).resolves.toEqual(validProfile);

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
    expect(setDoc).toHaveBeenCalledWith(documentReference, {
      uid: validProfile.uid,
      name: validProfile.name,
      email: validProfile.email,
      role: 'praktikan',
      authProvider: 'password',
      studentCode: validProfile.studentCode,
    });
    expect(validProfile.role).toBe('praktikan');
  });

  it('rejects public Asprak account creation before creating a Firebase account', async () => {
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValue(userCredential);

    await expect(registerWithEmailAndPassword({
      ...registrationInput,
      role: 'asisten',
      studentCode: '',
    })).rejects.toMatchObject({ code: 'invalid-input' });

    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('validates required fields, email, password length, and confirmation', () => {
    expect(validateRegistrationInput({ ...registrationInput, name: ' ' })).toBe(
      'Nama perlu diisi.',
    );
    expect(validateRegistrationInput({ ...registrationInput, email: 'not-an-email' })).toBe(
      'Masukkan alamat email yang valid.',
    );
    expect(validateRegistrationInput({ ...registrationInput, studentCode: '' })).toBe(
      'Kode mahasiswa perlu diisi.',
    );
    expect(validateRegistrationInput({ ...registrationInput, role: 'asisten', studentCode: '' })).toBe(
      'Akun Asprak hanya dapat dibuat dan diaktifkan oleh admin.',
    );
    expect(validateRegistrationInput({ ...registrationInput, password: '12345' })).toBe(
      'Kata sandi minimal 6 karakter.',
    );
    expect(
      validateRegistrationInput({ ...registrationInput, confirmPassword: 'tidak-sama' }),
    ).toBe('Konfirmasi kata sandi belum cocok.');
  });

  it('validates Google profile details according to the chosen role', () => {
    expect(validateGoogleProfileInput({ name: 'Ayu', role: 'praktikan' })).toBe(
      'Kode mahasiswa perlu diisi.',
    );
    expect(validateGoogleProfileInput({ name: 'Raka', role: 'asisten' })).toBe(
      'Akun Asprak hanya dapat dibuat dan diaktifkan oleh admin.',
    );
  });

  it('explains when the email is already in use', async () => {
    jest
      .mocked(createUserWithEmailAndPassword)
      .mockRejectedValue(firebaseError('auth/email-already-in-use'));

    await expect(registerWithEmailAndPassword(registrationInput)).rejects.toThrow(
      'Email ini sudah terdaftar. Coba masuk saja.',
    );
  });

  it('removes the auth user if saving the profile fails', async () => {
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValue(userCredential);
    jest.mocked(setDoc).mockRejectedValue(new Error('write failed'));

    await expect(registerWithEmailAndPassword(registrationInput)).rejects.toMatchObject({
      code: 'profile-save-failed',
    });
    expect(deleteUser).toHaveBeenCalledWith(user);
  });

  it('distinguishes Firestore permission denial during profile creation', async () => {
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValue(userCredential);
    jest.mocked(setDoc).mockRejectedValue(firebaseError('permission-denied'));

    await expect(registerWithEmailAndPassword(registrationInput)).rejects.toMatchObject({
      code: 'profile-save-permission-denied',
      message: expect.stringContaining('Firestore menolak'),
    });
  });

  it('reports when a failed profile write cannot be rolled back', async () => {
    jest.mocked(createUserWithEmailAndPassword).mockResolvedValue(userCredential);
    jest.mocked(setDoc).mockRejectedValue(new Error('write failed'));
    jest.mocked(deleteUser).mockRejectedValue(new Error('delete failed'));

    await expect(registerWithEmailAndPassword(registrationInput)).rejects.toMatchObject({
      code: 'rollback-failed',
    });
  });
});

describe('profile validation and login', () => {
  it('returns a profile only when it exists and the uid matches', async () => {
    jest.mocked(getDoc).mockResolvedValue(makeDocumentSnapshot(validProfile));

    await expect(getUserProfile('uid-1')).resolves.toEqual(validProfile);
    await expect(getUserProfile('another-uid')).rejects.toMatchObject({
      code: 'profile-uid-mismatch',
    });
  });

  it('resolves the Firestore asisten role without requiring redundant profile fields', async () => {
    jest.mocked(getDoc).mockResolvedValue(
      makeDocumentSnapshot({
        name: 'Raka Asisten',
        email: 'raka@example.com',
        role: 'asisten',
        authProvider: 'google',
      }),
    );

    await expect(getUserProfile('uid-1')).resolves.toEqual({
      uid: 'uid-1',
      name: 'Raka Asisten',
      email: 'raka@example.com',
      role: 'asisten',
    });
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
  });

  it('uses the same UID profile resolver for email login with an asisten role', async () => {
    jest.mocked(signInWithEmailAndPassword).mockResolvedValue(userCredential);
    jest.mocked(getDoc).mockResolvedValue(
      makeDocumentSnapshot({
        name: 'Raka Asisten',
        email: 'raka@example.com',
        role: 'asisten',
        authProvider: 'password',
      }),
    );

    await expect(
      signInWithEmailAndPasswordForProfile('raka@example.com', 'rahasia123'),
    ).resolves.toMatchObject({ uid: 'uid-1', role: 'asisten' });
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
  });

  it('rejects a missing profile', async () => {
    jest.mocked(getDoc).mockResolvedValue(makeDocumentSnapshot(null));

    await expect(getUserProfile('uid-1')).rejects.toMatchObject({
      code: 'profile-not-found',
    });
  });

  it('surfaces a profile read failure instead of returning a fallback user', async () => {
    jest.mocked(getDoc).mockRejectedValue(new Error('permission denied'));

    await expect(getUserProfile('uid-1')).rejects.toMatchObject({
      code: 'profile-read-failed',
    });
  });

  it('explains profile read network failures separately', async () => {
    jest.mocked(getDoc).mockRejectedValue(firebaseError('unavailable'));

    await expect(getUserProfile('uid-1')).rejects.toMatchObject({
      code: 'profile-read-failed',
      message: expect.stringContaining('koneksi internet'),
    });
  });

  it('explains Firestore permission errors without hiding the authenticated session', async () => {
    jest.mocked(getDoc).mockRejectedValue(firebaseError('permission-denied'));

    await expect(getUserProfile('uid-1')).rejects.toThrow(
      'Akses ke profil ditolak. Periksa aturan keamanan Firestore atau hubungi admin.',
    );
  });

  it('rejects an invalid profile role', async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValue(makeDocumentSnapshot({ ...validProfile, role: 'owner' }));

    await expect(getUserProfile('uid-1')).rejects.toMatchObject({
      code: 'invalid-profile',
    });
  });

  it('returns the Firestore profile after successful login', async () => {
    jest.mocked(signInWithEmailAndPassword).mockResolvedValue(userCredential);
    jest.mocked(getDoc).mockResolvedValue(makeDocumentSnapshot(validProfile));

    await expect(
      signInWithEmailAndPasswordForProfile('ayu@example.com', 'rahasia123'),
    ).resolves.toEqual(validProfile);
  });

  it('keeps the session active when login has no profile for recovery', async () => {
    jest.mocked(signInWithEmailAndPassword).mockResolvedValue(userCredential);
    jest.mocked(getDoc).mockResolvedValue(makeDocumentSnapshot(null));

    await expect(
      signInWithEmailAndPasswordForProfile('ayu@example.com', 'rahasia123'),
    ).rejects.toBeInstanceOf(AuthServiceError);
    expect(firebaseSignOut).not.toHaveBeenCalled();
  });

  it('shows a clear message when login credentials are rejected', async () => {
    jest
      .mocked(signInWithEmailAndPassword)
      .mockRejectedValue(firebaseError('auth/invalid-credential'));

    await expect(
      signInWithEmailAndPasswordForProfile('ayu@example.com', 'salah'),
    ).rejects.toThrow('Email atau kata sandi belum cocok.');
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('distinguishes emulator credential failures from emulator connection failures', () => {
    const previousEmulatorFlag = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    try {
      expect(getAuthErrorMessage(firebaseError('auth/invalid-credential')))
        .toContain('di Auth Emulator');
      expect(getAuthErrorMessage(firebaseError('auth/network-request-failed')))
        .toContain('Auth Emulator tidak dapat dijangkau');
    } finally {
      if (previousEmulatorFlag === undefined) {
        delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;
      } else {
        process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = previousEmulatorFlag;
      }
    }
  });

  it('identifies Firebase project configuration failures safely', () => {
    expect(getAuthErrorMessage(firebaseError('auth/invalid-api-key')))
      .toContain('Konfigurasi Firebase aplikasi tidak cocok');
  });
});

describe('Google Sign-In', () => {
  it('keeps native Google Sign-In from loading in Expo Go', async () => {
    Object.defineProperty(Constants, 'appOwnership', { configurable: true, value: 'expo' });

    expect(isGoogleSignInAvailable()).toBe(false);
    await expect(signInWithGoogleForProfile()).rejects.toMatchObject({
      code: 'google-requires-development-build',
    });
    expect(GoogleSignin.configure).not.toHaveBeenCalled();
  });

  it('authenticates with a Google ID token and resolves its Firestore profile', async () => {
    const previousClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    jest.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: {
        user: {
          id: 'google-uid',
          name: 'Ayu Pratiwi',
          email: 'ayu@example.com',
          photo: null,
          familyName: 'Pratiwi',
          givenName: 'Ayu',
        },
        scopes: [],
        idToken: 'google-id-token',
        serverAuthCode: null,
      },
    });
    jest.mocked(signInWithCredential).mockResolvedValue(userCredential);
    jest.mocked(getDoc).mockResolvedValue(
      makeDocumentSnapshot({
        name: 'Ayu Pratiwi',
        email: 'ayu@example.com',
        role: 'praktikan',
        authProvider: 'google',
      }),
    );

    try {
      await expect(signInWithGoogleForProfile()).resolves.toEqual({
        status: 'authenticated',
        profile: {
          uid: 'uid-1',
          name: 'Ayu Pratiwi',
          email: 'ayu@example.com',
          role: 'praktikan',
        },
      });
    } finally {
      if (previousClientId === undefined) {
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      } else {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = previousClientId;
      }
    }

    expect(GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: 'web-client-id',
      offlineAccess: false,
    });
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('google-id-token');
    expect(signInWithCredential).toHaveBeenCalled();
  });

  it('returns a profile completion step for a first-time Google account', async () => {
    const previousClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    jest.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: 'success',
      data: {
        user: {
          id: 'google-uid',
          name: 'New User',
          email: 'new@example.com',
          photo: null,
          familyName: null,
          givenName: null,
        },
        scopes: [],
        idToken: 'google-id-token',
        serverAuthCode: null,
      },
    });
    jest.mocked(signInWithCredential).mockResolvedValue({
      user: { uid: 'uid-1', email: 'new@example.com', displayName: 'New User' },
    } as Awaited<ReturnType<typeof signInWithCredential>>);
    jest.mocked(getDoc).mockResolvedValue(makeDocumentSnapshot(null));

    try {
      await expect(signInWithGoogleForProfile()).resolves.toEqual({
        status: 'registration-required',
        name: 'New User',
        email: 'new@example.com',
      });
    } finally {
      if (previousClientId === undefined) {
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      } else {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = previousClientId;
      }
    }

    expect(firebaseSignOut).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('creates a first-time Google profile at the authenticated UID without overwriting an existing one', async () => {
    Object.assign(auth, { currentUser: user });
    const existingDocument = {
      name: 'Ayu Pratiwi',
      email: 'ayu@example.com',
      role: 'asisten',
      authProvider: 'google',
    };
    mockTransactionGet.mockResolvedValue(makeDocumentSnapshot(existingDocument));
    jest.mocked(getDoc).mockResolvedValue(makeDocumentSnapshot(existingDocument));

    await expect(registerGoogleProfile({ name: 'New Name', role: 'praktikan', studentCode: 'NIM-1' }))
      .resolves.toMatchObject({ uid: 'uid-1', role: 'asisten' });

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
    expect(runTransaction).toHaveBeenCalled();
    expect(mockTransactionGet).toHaveBeenCalled();
    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('rejects public Google profile creation as Asprak', async () => {
    Object.assign(auth, { currentUser: user });

    await expect(registerGoogleProfile({ name: 'Raka Asisten', role: 'asisten' }))
      .rejects.toMatchObject({ code: 'invalid-input' });

    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('requires an authenticated Google provider before completing Google registration', async () => {
    Object.assign(auth, {
      currentUser: { ...user, providerData: [{ providerId: 'password' }] },
    });

    await expect(registerGoogleProfile({ name: 'Ayu', role: 'asisten' })).rejects.toMatchObject({
      code: 'google-registration-session-missing',
    });
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('creates a Google praktikan profile with the required student code', async () => {
    Object.assign(auth, { currentUser: user });
    jest.mocked(getDoc).mockResolvedValue(makeDocumentSnapshot({
      name: 'Ayu Pratiwi',
      email: 'ayu@example.com',
      role: 'praktikan',
      authProvider: 'google',
      studentCode: 'NIM-1',
    }));

    await registerGoogleProfile({ name: 'Ayu Pratiwi', role: 'praktikan', studentCode: 'NIM-1' });

    expect(mockTransactionSet).toHaveBeenCalledWith(documentReference, {
      uid: 'uid-1',
      name: 'Ayu Pratiwi',
      email: 'ayu@example.com',
      role: 'praktikan',
      authProvider: 'google',
      studentCode: 'NIM-1',
    });
  });

  it('treats a cancelled Google flow as cancellation rather than success', async () => {
    const previousClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    jest.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    jest.mocked(GoogleSignin.signIn).mockResolvedValue({ type: 'cancelled', data: null });

    try {
      await expect(signInWithGoogleForProfile()).resolves.toBeNull();
    } finally {
      if (previousClientId === undefined) {
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      } else {
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = previousClientId;
      }
    }
    expect(signInWithCredential).not.toHaveBeenCalled();
  });
});

describe('password reset', () => {
  it('sends a reset email after validating the email address', async () => {
    await expect(sendPasswordReset('ayu@example.com')).resolves.toBeUndefined();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'ayu@example.com');
  });

  it('rejects invalid addresses without contacting Firebase', async () => {
    await expect(sendPasswordReset('invalid')).rejects.toMatchObject({
      code: 'invalid-input',
    });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('clears Google and Firebase sessions without initiating navigation itself', async () => {
    Object.assign(auth, { currentUser: user });
    await signOut();

    expect(firebaseSignOut).toHaveBeenCalled();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(removeCurrentDeviceToken).toHaveBeenCalledTimes(1);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
    expect(jest.mocked(removeCurrentDeviceToken).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(GoogleSignin.signOut).mock.invocationCallOrder[0],
    );
    expect(jest.mocked(removeCurrentDeviceToken).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(firebaseSignOut).mock.invocationCallOrder[0],
    );
  });

  it('coalesces overlapping logout requests into one sign-out flow', async () => {
    Object.assign(auth, { currentUser: user });
    await Promise.all([signOut(), signOut()]);

    expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1);
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('still signs out of Firebase if clearing Google session fails', async () => {
    Object.assign(auth, { currentUser: user });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(GoogleSignin.signOut).mockRejectedValueOnce(new Error('google cleanup failed'));

    await signOut();

    expect(firebaseSignOut).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('does not call native Google Sign-In for an email-only session', async () => {
    Object.assign(auth, {
      currentUser: { ...user, providerData: [{ providerId: 'password' }] },
    });
    await signOut();

    expect(firebaseSignOut).toHaveBeenCalled();
    expect(GoogleSignin.signOut).not.toHaveBeenCalled();
  });

  it('reports a Firebase logout failure', async () => {
    jest.mocked(firebaseSignOut).mockRejectedValue(new Error('offline'));

    await expect(signOut()).rejects.toMatchObject({ code: 'logout-failed' });
  });

  it('completes logout even when device token removal fails', async () => {
    Object.assign(auth, { currentUser: user });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest
      .mocked(removeCurrentDeviceToken)
      .mockResolvedValue({ ok: false, reason: 'token tidak dapat dihapus' });

    await expect(signOut()).resolves.toBeUndefined();

    expect(firebaseSignOut).toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Periksa izin akunmu'),
      expect.anything(),
    );
    jest.restoreAllMocks();
  });
});
