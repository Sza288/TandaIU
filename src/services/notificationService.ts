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
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
  NotificationRegistrationStatus,
} from '../features/notification/notification.types';
import { auth, db } from '../lib/firebase';
import { getErrorKind, getErrorMessage } from '../utils/errorMessage';

const DEFAULT_ANDROID_CHANNEL_ID = 'default';
const DEVICE_TOKEN_REMOVAL_TIMEOUT_MS = 3000;

export type DeviceTokenRemovalResult = { ok: true } | { ok: false; reason: string };

export type NotificationRegistrationSnapshot = {
  status: NotificationRegistrationStatus;
  reason: string | null;
};

let registrationSnapshot: NotificationRegistrationSnapshot = { status: 'idle', reason: null };
const registrationListeners = new Set<
  (snapshot: NotificationRegistrationSnapshot) => void
>();
const registrationRetryListeners = new Set<() => void>();

export function getNotificationRegistrationSnapshot(): NotificationRegistrationSnapshot {
  return registrationSnapshot;
}

export function subscribeToNotificationRegistration(
  listener: (snapshot: NotificationRegistrationSnapshot) => void,
): () => void {
  registrationListeners.add(listener);
  return () => {
    registrationListeners.delete(listener);
  };
}

export function publishNotificationRegistration(
  snapshot: NotificationRegistrationSnapshot,
): void {
  registrationSnapshot = snapshot;
  registrationListeners.forEach((listener) => listener(snapshot));
}

export function requestNotificationRegistrationRetry(): void {
  registrationRetryListeners.forEach((listener) => listener());
}

export function subscribeToNotificationRegistrationRetry(listener: () => void): () => void {
  registrationRetryListeners.add(listener);
  return () => {
    registrationRetryListeners.delete(listener);
  };
}

let installationIdPromise: Promise<string> | null = null;
let androidChannelPromise: Promise<void> | null = null;

function isCurrentUser(uid: string): boolean {
  return auth.currentUser?.uid === uid;
}

function getFailureReason(error: unknown): string {
  return getErrorMessage(getErrorKind(error)).message;
}

const DEVTOKEN_DEBUG_TAG = '[DEVTOKEN]';

export function logNotificationDebug(event: string, details?: Record<string, unknown>): void {
  console.log(DEVTOKEN_DEBUG_TAG, event, details ?? {});
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : null;
}

function redactDebugText(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value
    .replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_API_KEY]')
    .replace(/\b[A-Za-z0-9_-]{80,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\b[A-Za-z0-9]{24,}\b/g, '[REDACTED_ID]')
    .replace(/device-[A-Za-z0-9-]+/g, '[REDACTED_INSTALLATION_ID]');
}

export function logNotificationError(event: string, error: unknown): void {
  const details =
    typeof error === 'object' && error !== null
      ? (error as { name?: unknown; message?: unknown; stack?: unknown })
      : null;
  const rawMessage = details ? details.message : error;
  logNotificationDebug(event, {
    code: getErrorCode(error) ?? getErrorKind(error),
    name: typeof details?.name === 'string' ? details.name : undefined,
    message: redactDebugText(rawMessage) ?? getFailureReason(error),
    stack: redactDebugText(details?.stack),
    safeMessage: getFailureReason(error),
  });
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
    logNotificationError('installationId:error', error);
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
      logNotificationError('androidChannel:error', error);
      androidChannelPromise = null;
      throw error;
    });

  return androidChannelPromise;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS !== 'android') return 'unsupported';

  const current = await getPermissionsAsync();
  logNotificationDebug('permission:current', {
    status: current.status,
    canAskAgain: current.canAskAgain,
  });
  if (current.status === PermissionStatus.GRANTED) return 'granted';
  if (!current.canAskAgain) return 'denied';

  const requested = await requestPermissionsAsync();
  logNotificationDebug('permission:requested', {
    status: requested.status,
    canAskAgain: requested.canAskAgain,
  });
  if (requested.status === PermissionStatus.GRANTED) return 'granted';
  if (requested.status === PermissionStatus.UNDETERMINED) return 'undetermined';
  return 'denied';
}

export async function getFcmDeviceToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  try {
    await ensureAndroidChannel();
    logNotificationDebug('fcm:getDevicePushTokenAsync:start');
    const deviceToken = await getDevicePushTokenAsync();
    logNotificationDebug('fcm:getDevicePushTokenAsync:result', {
      type: deviceToken.type,
      hasStringData: typeof deviceToken.data === 'string',
    });
    if (deviceToken.type !== 'android' || typeof deviceToken.data !== 'string') return null;

    const token = deviceToken.data.trim();
    const valid = isValidPushToken(token);
    logNotificationDebug('fcm:tokenValidation', { valid, length: token.length });
    return valid ? token : null;
  } catch (error) {
    logNotificationError('fcm:getDevicePushTokenAsync:error', error);
    throw error;
  }
}

export async function saveDeviceToken(
  uid: string,
  token: string,
): Promise<NotificationRegistrationResult> {
  logNotificationDebug('save:start', { hasUid: Boolean(uid), hasToken: Boolean(token) });
  try {
    if (!isCurrentUser(uid)) {
      logNotificationDebug('save:stop', { stage: 'session-mismatch', step: 'initial' });
      return cancelledRegistration();
    }

    const installationId = await getOrCreateInstallationId();
    logNotificationDebug('save:installationId', { available: Boolean(installationId) });
    if (!isCurrentUser(uid)) {
      logNotificationDebug('save:stop', { stage: 'session-mismatch', step: 'installationId' });
      return cancelledRegistration();
    }

    const docId = buildDeviceTokenDocId(installationId);
    if (!docId) {
      logNotificationDebug('save:stop', { stage: 'invalid-installation-id' });
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
      logNotificationDebug('save:stop', { stage: 'invalid-token' });
      return createNotificationRegistrationResult(false, 'error', {
        reason: 'Token perangkat tidak valid.',
      });
    }

    if (!isCurrentUser(uid)) {
      logNotificationDebug('save:stop', { stage: 'session-mismatch', step: 'before-write' });
      return cancelledRegistration();
    }

    logNotificationDebug('firestore:setDoc:before', { collection: DEVICE_PUSH_TOKEN_COLLECTION });
    await setDoc(doc(db, DEVICE_PUSH_TOKEN_COLLECTION, docId), payload);
    logNotificationDebug('firestore:setDoc:success', { collection: DEVICE_PUSH_TOKEN_COLLECTION });
    return createNotificationRegistrationResult(true, 'granted', { token });
  } catch (error) {
    logNotificationError('save:error', error);
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

      const tokenRef = doc(db, DEVICE_PUSH_TOKEN_COLLECTION, docId);
      const existing = await getDoc(tokenRef);
      if (!existing.exists()) {
        logNotificationDebug('removeToken:missing', { collection: DEVICE_PUSH_TOKEN_COLLECTION });
        return { ok: true };
      }

      await deleteDoc(tokenRef);
      return { ok: true };
    } catch (error) {
      logNotificationError('removeToken:error', error);
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
  logNotificationDebug('tokenRefresh:subscribe', { hasUid: Boolean(uid) });
  const subscription = addPushTokenListener((deviceToken) => {
    void (async () => {
      const accepted =
        Platform.OS === 'android' &&
        deviceToken.type === 'android' &&
        typeof deviceToken.data === 'string' &&
        isCurrentUser(uid);
      logNotificationDebug('tokenRefresh:event', { accepted });
      if (!accepted) return;

      const token = deviceToken.data.trim();
      const valid = isValidPushToken(token);
      logNotificationDebug('tokenRefresh:tokenValidation', { valid });
      if (!valid) return;

      onResult(await saveDeviceToken(uid, token));
    })().catch((error: unknown) => {
      logNotificationError('tokenRefresh:error', error);
      onResult(
        createNotificationRegistrationResult(false, 'error', { reason: getFailureReason(error) }),
      );
    });
  });

  return () => {
    logNotificationDebug('tokenRefresh:unsubscribe');
    subscription.remove();
  };
}

export async function registerDeviceForPush(uid: string): Promise<NotificationRegistrationResult> {
  logNotificationDebug('register:start', { hasUid: Boolean(uid), platform: Platform.OS });
  try {
    const currentUid = uid.trim();
    if (!currentUid) {
      logNotificationDebug('register:stop', { stage: 'uid-empty' });
      return createNotificationRegistrationResult(false, 'error', {
        reason: 'Akun belum tersedia.',
      });
    }
    if (normalizeNotificationPlatform(Platform.OS) !== 'android') {
      logNotificationDebug('register:stop', { stage: 'unsupported-platform' });
      return createNotificationRegistrationResult(true, 'unsupported');
    }
    if (!isCurrentUser(currentUid)) {
      logNotificationDebug('register:stop', { stage: 'session-mismatch', step: 'initial' });
      return cancelledRegistration();
    }

    await ensureAndroidChannel();
    logNotificationDebug('register:channel-ready');
    if (!isCurrentUser(currentUid)) {
      logNotificationDebug('register:stop', { stage: 'session-mismatch', step: 'channel' });
      return cancelledRegistration();
    }

    const permission = await requestNotificationPermission();
    logNotificationDebug('register:permission', { state: permission });
    if (permission === 'unsupported') {
      return createNotificationRegistrationResult(true, 'unsupported');
    }
    if (permission === 'denied') {
      logNotificationDebug('register:stop', { stage: 'permission-denied' });
      return createNotificationRegistrationResult(false, 'denied', {
        reason: 'Izin notifikasi ditolak.',
      });
    }
    if (permission !== 'granted') {
      logNotificationDebug('register:stop', { stage: 'permission-pending' });
      return createNotificationRegistrationResult(false, 'idle', {
        reason: 'Izin notifikasi belum diberikan.',
      });
    }
    if (!isCurrentUser(currentUid)) {
      logNotificationDebug('register:stop', { stage: 'session-mismatch', step: 'permission' });
      return cancelledRegistration();
    }

    const token = await getFcmDeviceToken();
    logNotificationDebug('register:fcmToken', { length: token?.length ?? 0 });
    if (!token) {
      logNotificationDebug('register:stop', { stage: 'token-unavailable' });
      return createNotificationRegistrationResult(false, 'error', {
        reason: 'Token FCM tidak tersedia.',
      });
    }
    if (!isCurrentUser(currentUid)) {
      logNotificationDebug('register:stop', { stage: 'session-mismatch', step: 'token' });
      return cancelledRegistration();
    }

    const result = await saveDeviceToken(currentUid, token);
    logNotificationDebug('register:complete', { ok: result.ok, status: result.status });
    return result;
  } catch (error) {
    logNotificationError('register:error', error);
    return createNotificationRegistrationResult(false, 'error', { reason: getFailureReason(error) });
  }
}
