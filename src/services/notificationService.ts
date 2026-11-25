import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionStatus, Platform } from 'expo';
import {
  addPushTokenListener,
  AndroidImportance,
  getDevicePushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  DEVICE_INSTALLATION_ID_STORAGE_KEY,
  DEVICE_PUSH_TOKEN_COLLECTION,
  buildDeviceTokenDocId,
  buildDeviceTokenPayload,
  createNotificationRegistrationResult,
  isValidDeviceInstallationId,
  isValidPushToken,
  normalizeNotificationPlatform,
} from '../features/notification/notification.utils';
import type {
  NotificationPermissionState,
  NotificationRegistrationResult,
} from '../features/notification/notification.types';
import { auth, db } from '../lib/firebase';
import { getErrorKind, getErrorMessage } from '../utils/errorMessage';

const DEFAULT_ANDROID_CHANNEL_ID = 'default';
const DEVICE_TOKEN_REMOVAL_TIMEOUT_MS = 3000;

export type DeviceTokenRemovalResult = { ok: true } | { ok: false; reason: string };

let installationIdPromise: Promise<string> | null = null;
let androidChannelPromise: Promise<void> | null = null;

function isCurrentUser(uid: string): boolean {
  return auth.currentUser?.uid === uid;
}

function getFailureReason(error: unknown): string {
  return getErrorMessage(getErrorKind(error)).message;
}

function cancelledRegistration(): NotificationRegistrationResult {
  return createNotificationRegistrationResult(false, 'idle', {
    reason: 'Sesi pengguna berubah saat registrasi.',
  });
}

export async function getOrCreateInstallationId(): Promise<string> {
  if (installationIdPromise) return installationIdPromise;

  installationIdPromise = (async () => {
    const stored = await AsyncStorage.getItem(DEVICE_INSTALLATION_ID_STORAGE_KEY);
    if (stored && isValidDeviceInstallationId(stored)) return stored.trim();

    const created = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    if (!isValidDeviceInstallationId(created)) {
      throw new Error('ID instalasi perangkat tidak valid.');
    }
    await AsyncStorage.setItem(DEVICE_INSTALLATION_ID_STORAGE_KEY, created);
    return created;
  })().catch((error: unknown) => {
    installationIdPromise = null;
    throw error;
  });

  return installationIdPromise;
}

export function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (androidChannelPromise) return androidChannelPromise;

  androidChannelPromise = setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, {
    name: 'Notifikasi',
    importance: AndroidImportance.DEFAULT,
  })
    .then(() => undefined)
    .catch((error: unknown) => {
      androidChannelPromise = null;
      throw error;
    });

  return androidChannelPromise;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS !== 'android') return 'unsupported';

  const current = await getPermissionsAsync();
  if (current.status === PermissionStatus.GRANTED) return 'granted';
  if (current.status !== PermissionStatus.UNDETERMINED || !current.canAskAgain) return 'denied';

  const requested = await requestPermissionsAsync();
  if (requested.status === PermissionStatus.GRANTED) return 'granted';
  if (requested.status === PermissionStatus.UNDETERMINED) return 'undetermined';
  return 'denied';
}

export async function getFcmDeviceToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  await ensureAndroidChannel();
  const deviceToken = await getDevicePushTokenAsync();
  if (deviceToken.type !== 'android' || typeof deviceToken.data !== 'string') return null;

  const token = deviceToken.data.trim();
  return isValidPushToken(token) ? token : null;
}

export async function saveDeviceToken(
  uid: string,
  token: string,
): Promise<NotificationRegistrationResult> {
  try {
    if (!isCurrentUser(uid)) return cancelledRegistration();

    const installationId = await getOrCreateInstallationId();
    if (!isCurrentUser(uid)) return cancelledRegistration();

    const docId = buildDeviceTokenDocId(installationId);
    if (!docId) {
      return createNotificationRegistrationResult(false, 'error', {
        reason: 'ID instalasi perangkat tidak valid.',
      });
    }

    const payload = buildDeviceTokenPayload({
      uid,
      token,
      platform: 'android',
      updatedAt: serverTimestamp(),
    });
    if (!payload) {
      return createNotificationRegistrationResult(false, 'error', {
        reason: 'Token perangkat tidak valid.',
      });
    }

    if (!isCurrentUser(uid)) return cancelledRegistration();

    await setDoc(doc(db, DEVICE_PUSH_TOKEN_COLLECTION, docId), payload);
    return createNotificationRegistrationResult(true, 'granted', { token });
  } catch (error) {
    return createNotificationRegistrationResult(false, 'error', { reason: getFailureReason(error) });
  }
}

export function removeCurrentDeviceToken(): Promise<DeviceTokenRemovalResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DeviceTokenRemovalResult>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ ok: false, reason: 'timeout' }),
      DEVICE_TOKEN_REMOVAL_TIMEOUT_MS,
    );
  });

  const removal = (async (): Promise<DeviceTokenRemovalResult> => {
    try {
      const installationId = await getOrCreateInstallationId();
      const docId = buildDeviceTokenDocId(installationId);
      if (!docId) return { ok: true };

      await deleteDoc(doc(db, DEVICE_PUSH_TOKEN_COLLECTION, docId));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: getFailureReason(error) };
    }
  })();

  return Promise.race([removal, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

export function subscribeToTokenRefresh(
  uid: string,
  onResult: (result: NotificationRegistrationResult) => void,
): () => void {
  const subscription = addPushTokenListener((deviceToken) => {
    void (async () => {
      if (
        Platform.OS !== 'android' ||
        deviceToken.type !== 'android' ||
        typeof deviceToken.data !== 'string' ||
        !isCurrentUser(uid)
      ) {
        return;
      }

      const token = deviceToken.data.trim();
      if (!isValidPushToken(token)) return;

      onResult(await saveDeviceToken(uid, token));
    })().catch((error: unknown) => {
      onResult(
        createNotificationRegistrationResult(false, 'error', { reason: getFailureReason(error) }),
      );
    });
  });

  return () => subscription.remove();
}

export async function registerDeviceForPush(uid: string): Promise<NotificationRegistrationResult> {
  try {
    const currentUid = uid.trim();
    if (!currentUid) {
      return createNotificationRegistrationResult(false, 'error', {
        reason: 'Akun belum tersedia.',
      });
    }
    if (normalizeNotificationPlatform(Platform.OS) !== 'android') {
      return createNotificationRegistrationResult(true, 'unsupported');
    }
    if (!isCurrentUser(currentUid)) return cancelledRegistration();

    await ensureAndroidChannel();
    if (!isCurrentUser(currentUid)) return cancelledRegistration();

    const permission = await requestNotificationPermission();
    if (permission === 'unsupported') {
      return createNotificationRegistrationResult(true, 'unsupported');
    }
    if (permission === 'denied') {
      return createNotificationRegistrationResult(false, 'denied', {
        reason: 'Izin notifikasi ditolak.',
      });
    }
    if (permission !== 'granted') {
      return createNotificationRegistrationResult(false, 'idle', {
        reason: 'Izin notifikasi belum diberikan.',
      });
    }
    if (!isCurrentUser(currentUid)) return cancelledRegistration();

    const token = await getFcmDeviceToken();
    if (!token) {
      return createNotificationRegistrationResult(false, 'error', {
        reason: 'Token FCM tidak tersedia.',
      });
    }
    if (!isCurrentUser(currentUid)) return cancelledRegistration();

    return await saveDeviceToken(currentUid, token);
  } catch (error) {
    return createNotificationRegistrationResult(false, 'error', { reason: getFailureReason(error) });
  }
}
