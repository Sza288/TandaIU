import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Message, type Messaging } from 'firebase-admin/messaging';
import { logger as firebaseLogger } from 'firebase-functions';
import type { FirestoreData } from './recipients';
import type {
  DeviceTokenStore,
  MessagingSender,
  NotificationLogger,
} from './sendTokens';

export type NotificationDeps = {
  logger: NotificationLogger;
  sender: MessagingSender;
  tokenStore: DeviceTokenStore;
  listEnrollments(classId: string): Promise<readonly FirestoreData[]>;
  getSession(sessionId: string): Promise<FirestoreData | null>;
};

export function initializeFirebaseAdmin(): App {
  const defaultApp = getApps().find((app) => app.name === '[DEFAULT]');
  return defaultApp ?? initializeApp({ credential: applicationDefault() });
}

export function getAdminFirestore(): Firestore {
  initializeFirebaseAdmin();
  return getFirestore();
}

export function getAdminMessaging(): Messaging {
  initializeFirebaseAdmin();
  return getMessaging();
}

export function createAdminLogger(): NotificationLogger {
  return {
    log: (message) => firebaseLogger.info(message),
    error: (message) => firebaseLogger.error(message),
  };
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createAdminDeps(logger: NotificationLogger = createAdminLogger()): NotificationDeps {
  const firestore = getAdminFirestore();
  const messaging = getAdminMessaging();

  return {
    logger,
    sender: {
      async sendEach(messages, dryRun) {
        const response = await messaging.sendEach([...messages] as Message[], dryRun);
        return {
          responses: response.responses.map((item) => ({
            success: item.success,
            error: item.error,
          })),
        };
      },
    },
    tokenStore: {
      async listByUids(uids) {
        if (uids.length === 0) return [];
        const snapshot = await firestore
          .collection('deviceTokens')
          .where('uid', 'in', [...uids])
          .get();
        return snapshot.docs.map((doc) => {
          const data = doc.data() as FirestoreData;
          return {
            id: doc.id,
            uid: typeof data.uid === 'string' ? data.uid : '',
            token: typeof data.token === 'string' ? data.token : '',
          };
        });
      },
      async remove(docId) {
        await firestore.collection('deviceTokens').doc(docId).delete();
      },
    },
    async listEnrollments(classId) {
      if (!classId) return [];
      const snapshot = await firestore
        .collection('enrollments')
        .where('classId', '==', classId)
        .get();
      return snapshot.docs.map((doc) => doc.data() as FirestoreData);
    },
    async getSession(sessionId) {
      if (!sessionId) return null;
      const snapshot = await firestore.collection('sessions').doc(sessionId).get();
      return snapshot.exists ? (snapshot.data() as FirestoreData) : null;
    },
  };
}
