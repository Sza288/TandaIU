import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  type Persistence,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// Firebase's React Native runtime exports this API, but its shared types omit it.
const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

// Environment variables exported by Expo (EXPO_PUBLIC_*)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
export const db = getFirestore(app);

const emulatorFlag = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;
if (emulatorFlag && emulatorFlag !== 'true' && emulatorFlag !== 'false') {
  throw new Error('EXPO_PUBLIC_USE_FIREBASE_EMULATOR harus bernilai true atau false.');
}

if (emulatorFlag === 'true') {
  if (!__DEV__) {
    throw new Error('Firebase Emulator hanya boleh diaktifkan pada development build.');
  }
  if (firebaseConfig.projectId !== 'demo-tandaiu-rules') {
    throw new Error('Firebase Emulator hanya diizinkan untuk project demo-tandaiu-rules.');
  }
  const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST?.trim();
  if (!emulatorHost || /:\/\/|\s/.test(emulatorHost)) {
    throw new Error('Isi EXPO_PUBLIC_FIREBASE_EMULATOR_HOST dengan IP LAN laptop tanpa protokol.');
  }

  type EmulatorConnectionState = { authHost?: string; firestoreHost?: string };
  type FirebaseGlobal = typeof globalThis & {
    __tandaiuFirebaseEmulatorConnections?: Map<string, EmulatorConnectionState>;
  };
  const firebaseGlobal = globalThis as FirebaseGlobal;
  const connections = firebaseGlobal.__tandaiuFirebaseEmulatorConnections
    ?? (firebaseGlobal.__tandaiuFirebaseEmulatorConnections = new Map());
  const state = connections.get(app.name) ?? {};

  if (state.authHost && state.authHost !== emulatorHost) {
    throw new Error('Auth Emulator sudah tersambung ke host lain. Restart Expo sebelum mengganti IP.');
  }
  if (!state.authHost) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    state.authHost = emulatorHost;
  }

  if (state.firestoreHost && state.firestoreHost !== emulatorHost) {
    throw new Error('Firestore Emulator sudah tersambung ke host lain. Restart Expo sebelum mengganti IP.');
  }
  if (!state.firestoreHost) {
    connectFirestoreEmulator(db, emulatorHost, 8080);
    state.firestoreHost = emulatorHost;
  }

  connections.set(app.name, state);
  if (__DEV__) {
    console.info(`[firebase] Emulator aktif: project=${firebaseConfig.projectId}, host=${emulatorHost}`);
  }
}
