import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('firebase/app', () => ({
  getApp: jest.fn(() => ({ name: 'test-app' })),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({ name: 'test-app' })),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ name: 'test-auth' })),
  getReactNativePersistence: jest.fn((storage) => ({ storage })),
  initializeAuth: jest.fn(() => ({ name: 'test-auth' })),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ name: 'test-firestore' })),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

it('initializes native Firebase Auth once with AsyncStorage persistence', () => {
  expect(getApps).toHaveBeenCalledTimes(1);
  expect(initializeApp).toHaveBeenCalledTimes(1);
  expect(jest.requireMock('firebase/auth').getReactNativePersistence).toHaveBeenCalledWith(
    AsyncStorage,
  );
  expect(initializeAuth).toHaveBeenCalledTimes(1);
  expect(initializeAuth).toHaveBeenCalledWith(
    { name: 'test-app' },
    { persistence: { storage: AsyncStorage } },
  );
  expect(getAuth).not.toHaveBeenCalled();
  expect(auth).toEqual({ name: 'test-auth' });
  expect(db).toEqual({ name: 'test-firestore' });
});
