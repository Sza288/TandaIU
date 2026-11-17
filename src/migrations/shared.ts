import {
  collection,
  getDocs,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

export const MIGRATION_COLLECTIONS = [
  'users',
  'classes',
  'schedules',
  'sessions',
  'enrollments',
  'attendances',
  'permits',
  'reviews',
] as const;

export type MigrationCollectionName = (typeof MIGRATION_COLLECTIONS)[number];

export type RawDocument = {
  id: string;
  data: DocumentData;
};

export type CollectionRead = {
  name: string;
  docs: RawDocument[];
  count: number | null;
  error?: string;
};

/**
 * The migration modules are also used by a Node entry point, so the Firebase
 * instance is injected. The app keeps using `src/lib/firebase.ts` through this
 * lazy default instead of importing React Native at module load time.
 */
export function getDefaultDatabase(): Firestore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const firebase = require('../lib/firebase') as typeof import('../lib/firebase');
  return firebase.db;
}

export function firestoreErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  return typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null;
}

export function isPermissionDenied(error: unknown): boolean {
  return firestoreErrorCode(error) === 'permission-denied';
}

export function describeFirestoreError(error: unknown): string {
  const code = firestoreErrorCode(error);
  if (code === 'permission-denied') {
    return 'permission-denied: Security Rules menolak operasi ini.';
  }
  if (code === 'unavailable') {
    return 'unavailable: koneksi Firestore tidak tersedia.';
  }
  if (code === 'deadline-exceeded') {
    return 'deadline-exceeded: operasi Firestore melewati batas waktu.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Terjadi kesalahan Firestore.';
}

export async function readCollectionDocuments(
  database: Firestore,
  name: string,
): Promise<CollectionRead> {
  try {
    const snapshot = await getDocs(collection(database, name));
    return {
      name,
      docs: snapshot.docs.map((document) => ({
        id: document.id,
        data: document.data(),
      })),
      count: snapshot.size,
    };
  } catch (error) {
    return {
      name,
      docs: [],
      count: null,
      error: describeFirestoreError(error),
    };
  }
}

export async function readCollectionCount(
  database: Firestore,
  name: string,
): Promise<{ name: string; count: number | null; error?: string }> {
  const read = await readCollectionDocuments(database, name);
  return { name: read.name, count: read.count, ...(read.error ? { error: read.error } : {}) };
}

export async function readCollectionCounts(
  database: Firestore = getDefaultDatabase(),
): Promise<{ name: string; count: number | null; error?: string }[]> {
  return Promise.all(MIGRATION_COLLECTIONS.map((name) => readCollectionCount(database, name)));
}

export function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
