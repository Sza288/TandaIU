import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  toUserRole,
  type AuthProfile,
  type RegistrationRole,
} from '../features/auth/authTypes';

export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  studentCode: string;
  role: RegistrationRole;
};

export type GoogleSignInResult =
  | { status: 'authenticated'; profile: AuthProfile }
  | { status: 'registration-required'; name: string; email: string }
  | null;

export type AuthServiceErrorCode =
  | 'invalid-input'
  | 'google-configuration-missing'
  | 'google-requires-development-build'
  | 'google-sign-in-failed'
  | 'google-account-not-registered'
  | 'profile-not-found'
  | 'profile-uid-mismatch'
  | 'invalid-profile'
  | 'profile-read-failed'
  | 'profile-save-failed'
  | 'profile-save-permission-denied'
  | 'profile-save-network-failed'
  | 'google-registration-session-missing'
  | 'rollback-failed'
  | 'authentication-failed'
  | 'password-reset-failed'
  | 'logout-failed';

let pendingSignOut: Promise<void> | null = null;

export class AuthServiceError extends Error {
  constructor(
    public readonly code: AuthServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export function validateRegistrationInput(input: RegistrationInput): string | null {
  if (!input.name.trim()) {
    return 'Nama perlu diisi.';
  }
  if (!input.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return 'Masukkan alamat email yang valid.';
  }
  if (input.role !== 'praktikan' && input.role !== 'asisten') {
    return 'Pilih peran akun yang valid.';
  }
  if (input.role === 'praktikan' && !input.studentCode.trim()) {
    return 'Kode mahasiswa perlu diisi.';
  }
  if (input.password.length < 6) {
    return 'Kata sandi minimal 6 karakter.';
  }
  if (input.password !== input.confirmPassword) {
    return 'Konfirmasi kata sandi belum cocok.';
  }
  return null;
}

export function validateGoogleProfileInput(input: {
  name: string;
  role: RegistrationRole;
  studentCode?: string;
}): string | null {
  if (!input.name.trim()) {
    return 'Nama perlu diisi.';
  }
  if (input.role !== 'praktikan' && input.role !== 'asisten') {
    return 'Pilih peran akun yang valid.';
  }
  if (input.role === 'praktikan' && !input.studentCode?.trim()) {
    return 'Kode mahasiswa perlu diisi.';
  }
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isGoogleSignInAvailable(): boolean {
  return Platform.OS === 'web' || Constants.appOwnership !== 'expo';
}

function firebaseErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  return typeof error.code === 'string' ? error.code : null;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthServiceError) {
    return error.message;
  }

  switch (firebaseErrorCode(error)) {
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Coba masuk saja.';
    case 'auth/invalid-email':
      return 'Format email belum benar.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email atau kata sandi belum cocok.';
    case 'auth/user-disabled':
      return 'Akun ini sedang dinonaktifkan. Hubungi admin.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu mudah ditebak. Coba gunakan yang lebih kuat.';
    case 'auth/network-request-failed':
      return 'Koneksi terputus. Periksa internetmu lalu coba lagi.';
    case 'auth/operation-not-allowed':
      return 'Metode masuk ini belum diaktifkan. Hubungi admin.';
    case 'auth/account-exists-with-different-credential':
      return 'Email ini sudah memakai metode masuk lain. Coba masuk dengan email dan kata sandi.';
    case 'auth/popup-closed-by-user':
      return 'Jendela Google tertutup sebelum proses selesai.';
    case 'permission-denied':
      return 'Firestore menolak akses. Pastikan aturan mengizinkan akun ini membuat atau membaca profilnya sendiri.';
    case 'unavailable':
    case 'deadline-exceeded':
    case 'network-request-failed':
      return 'Koneksi ke Firebase bermasalah. Periksa internet lalu coba lagi.';
    default:
      return 'Ada kendala saat menghubungkan akun. Coba lagi sebentar.';
  }
}

function makeProfile(data: Record<string, unknown>, expectedUid: string): AuthProfile {
  if (data.uid !== undefined && data.uid !== expectedUid) {
    throw new AuthServiceError(
      'profile-uid-mismatch',
      'Data akun tidak cocok dengan sesi ini. Hubungi admin sebelum mencoba lagi.',
    );
  }
  const role = toUserRole(data.role);
  if (
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    typeof data.email !== 'string' ||
    !data.email.trim() ||
    !role
  ) {
    throw new AuthServiceError(
      'invalid-profile',
      'Profil akun belum lengkap atau perannya tidak valid. Hubungi admin.',
    );
  }

  return {
    uid: expectedUid,
    name: data.name,
    email: data.email,
    role,
    ...(typeof data.studentCode === 'string' && data.studentCode.trim()
      ? { studentCode: data.studentCode }
      : {}),
  };
}

export async function getUserProfile(uid: string): Promise<AuthProfile> {
  let snapshot;
  try {
    snapshot = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    const errorCode = firebaseErrorCode(error);
    if (__DEV__) {
      console.warn('[auth] Firestore profile lookup failed:', errorCode ?? 'unknown-error');
    }
    if (errorCode === 'permission-denied') {
      throw new AuthServiceError(
        'profile-read-failed',
        'Akses ke profil ditolak. Periksa aturan keamanan Firestore atau hubungi admin.',
      );
    }
    if (
      errorCode === 'unavailable' ||
      errorCode === 'deadline-exceeded' ||
      errorCode === 'network-request-failed'
    ) {
      throw new AuthServiceError(
        'profile-read-failed',
        'Layanan profil sedang tidak tersedia. Periksa koneksi internet lalu coba lagi.',
      );
    }
    throw new AuthServiceError(
      'profile-read-failed',
      'Profil akun tidak dapat dimuat. Periksa koneksi atau hubungi admin.',
    );
  }

  if (!snapshot.exists()) {
    throw new AuthServiceError(
      'profile-not-found',
      'Profil akun belum tersedia. Hubungi admin agar akunmu dapat diaktifkan.',
    );
  }

  return makeProfile(snapshot.data() as Record<string, unknown>, uid);
}

export async function registerWithEmailAndPassword(
  input: RegistrationInput,
): Promise<AuthProfile> {
  const validationMessage = validateRegistrationInput(input);
  if (validationMessage) {
    throw new AuthServiceError('invalid-input', validationMessage);
  }

  let user: User;
  try {
    const credentials = await createUserWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password,
    );
    user = credentials.user;
  } catch (error) {
    throw new AuthServiceError('authentication-failed', getAuthErrorMessage(error));
  }

  const profile: AuthProfile = {
    uid: user.uid,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
    ...(input.role === 'praktikan' ? { studentCode: input.studentCode.trim() } : {}),
  };

  try {
    await setDoc(doc(db, 'users', user.uid), {
      name: profile.name,
      email: profile.email,
      role: profile.role,
      authProvider: 'password',
      ...(profile.studentCode ? { studentCode: profile.studentCode } : {}),
    });
  } catch (error) {
    try {
      await deleteUser(user);
    } catch {
      throw new AuthServiceError(
        'rollback-failed',
        'Profil gagal disimpan dan akun baru belum berhasil dibersihkan. Hubungi admin.',
      );
    }
    const code = firebaseErrorCode(error);
    if (code === 'permission-denied') {
      throw new AuthServiceError(
        'profile-save-permission-denied',
        'Firestore menolak pembuatan profil. Minta admin memeriksa aturan akses registrasi mandiri.',
      );
    }
    if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') {
      throw new AuthServiceError(
        'profile-save-network-failed',
        'Profil belum tersimpan karena koneksi Firebase bermasalah. Periksa internet lalu daftar kembali.',
      );
    }
    throw new AuthServiceError('profile-save-failed', 'Profil akun gagal disimpan. Silakan coba lagi.');
  }

  return profile;
}

export async function registerGoogleProfile(input: {
  name: string;
  role: RegistrationRole;
  studentCode?: string;
}): Promise<AuthProfile> {
  const validationMessage = validateGoogleProfileInput(input);
  if (validationMessage) {
    throw new AuthServiceError('invalid-input', validationMessage);
  }

  const user = auth.currentUser;
  if (!user?.email || !user.providerData.some((provider) => provider.providerId === 'google.com')) {
    throw new AuthServiceError(
      'google-registration-session-missing',
      'Sesi Google tidak ditemukan. Silakan masuk dengan Google kembali.',
    );
  }

  const profileRef = doc(db, 'users', user.uid);
  const profileData = {
    name: input.name.trim(),
    email: user.email,
    role: input.role,
    authProvider: 'google',
    ...(input.role === 'praktikan' ? { studentCode: input.studentCode?.trim() } : {}),
  };

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      if (!snapshot.exists()) {
        transaction.set(profileRef, profileData);
      }
    });
  } catch (error) {
    const code = firebaseErrorCode(error);
    if (code === 'permission-denied') {
      throw new AuthServiceError(
        'profile-save-permission-denied',
        'Firestore menolak pembuatan profil. Minta admin memeriksa aturan akses registrasi mandiri.',
      );
    }
    if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') {
      throw new AuthServiceError(
        'profile-save-network-failed',
        'Profil belum tersimpan karena koneksi Firebase bermasalah. Periksa internet lalu coba lagi.',
      );
    }
    throw new AuthServiceError('profile-save-failed', 'Profil akun gagal disimpan. Silakan coba lagi.');
  }

  return getUserProfile(user.uid);
}

export async function signInWithGoogleForProfile(): Promise<GoogleSignInResult> {
  let user: User;

  if (Platform.OS === 'web') {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      user = result.user;
    } catch (error) {
      if (firebaseErrorCode(error) === 'auth/popup-closed-by-user') {
        return null;
      }
      throw new AuthServiceError('google-sign-in-failed', getAuthErrorMessage(error));
    }
  } else {
    if (!isGoogleSignInAvailable()) {
      throw new AuthServiceError(
        'google-requires-development-build',
        'Google Sign-In membutuhkan development build. Kamu tetap bisa masuk dengan email.',
      );
    }

    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      throw new AuthServiceError(
        'google-configuration-missing',
        'Google Sign-In belum dikonfigurasi untuk aplikasi ini. Hubungi admin.',
      );
    }

    try {
      // Expo Go does not include this native module, so keep its loading lazy.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin, isSuccessResponse } = require(
        '@react-native-google-signin/google-signin',
      ) as typeof import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ webClientId, offlineAccess: false });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return null;
      }
      if (!response.data.idToken) {
        throw new AuthServiceError(
          'google-sign-in-failed',
          'Google tidak mengembalikan token identitas. Coba lagi.',
        );
      }
      const credential = GoogleAuthProvider.credential(response.data.idToken);
      const result = await signInWithCredential(auth, credential);
      user = result.user;
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }
      throw new AuthServiceError('google-sign-in-failed', getAuthErrorMessage(error));
    }
  }

  try {
    return { status: 'authenticated', profile: await getUserProfile(user.uid) };
  } catch (error) {
    if (error instanceof AuthServiceError && error.code === 'profile-not-found') {
      return {
        status: 'registration-required',
        name: user.displayName ?? '',
        email: user.email ?? '',
      };
    }
    throw error;
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!isValidEmail(email)) {
    throw new AuthServiceError('invalid-input', 'Masukkan email yang valid untuk reset kata sandi.');
  }
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    throw new AuthServiceError('password-reset-failed', getAuthErrorMessage(error));
  }
}

export async function signInWithEmailAndPasswordForProfile(
  email: string,
  password: string,
): Promise<AuthProfile> {
  let uid: string;
  try {
    const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
    uid = credentials.user.uid;
  } catch (error) {
    throw new AuthServiceError('authentication-failed', getAuthErrorMessage(error));
  }

  return getUserProfile(uid);
}

export async function signOut(): Promise<void> {
  if (pendingSignOut) return pendingSignOut;

  pendingSignOut = (async () => {
    const hasGoogleProvider = auth.currentUser?.providerData.some(
      (provider) => provider.providerId === 'google.com',
    ) ?? false;

    if (hasGoogleProvider && Platform.OS !== 'web' && Constants.appOwnership !== 'expo') {
      try {
        // Expo Go does not include this native module; load it only in a development build.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { GoogleSignin } = require(
          '@react-native-google-signin/google-signin',
        ) as typeof import('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch (error) {
        if (__DEV__) {
          console.warn(
            '[auth] Google Sign-In cleanup failed during logout:',
            firebaseErrorCode(error) ?? 'unknown-error',
          );
        }
      }
    }

    try {
      // AuthNavigationGate observes this state change and performs the single route transition.
      await firebaseSignOut(auth);
    } catch (error) {
      throw new AuthServiceError('logout-failed', getAuthErrorMessage(error));
    }
  })().finally(() => {
    pendingSignOut = null;
  });

  return pendingSignOut;
}
