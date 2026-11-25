import type { NotificationDeps } from '../src/admin';
import type { FirestoreData } from '../src/recipients';
import type { FcmMessage, SendBatchResponse } from '../src/sendTokens';

export type DepsMockOptions = {
  enrollments?: Record<string, readonly FirestoreData[]>;
  sessions?: Record<string, FirestoreData>;
  failingListEnrollments?: boolean;
  failingGetSession?: boolean;
  responder?: (messages: readonly FcmMessage[]) => SendBatchResponse;
};

export function createDepsMock(options: DepsMockOptions = {}) {
  const sentMessages: FcmMessage[] = [];
  const queriedUids: string[] = [];
  const enrollmentCalls: string[] = [];
  const sessionCalls: string[] = [];
  const logMessages: string[] = [];
  const errorMessages: string[] = [];

  const deps: NotificationDeps = {
    logger: {
      log: (message) => logMessages.push(message),
      error: (message) => errorMessages.push(message),
    },
    sender: {
      async sendEach(messages) {
        sentMessages.push(...messages);
        return options.responder
          ? options.responder(messages)
          : { responses: messages.map(() => ({ success: true })) };
      },
    },
    tokenStore: {
      async listByUids(uids) {
        queriedUids.push(...uids);
        return uids.map((uid) => ({ id: `d-${uid}`, uid, token: `t-${uid}` }));
      },
      async remove() {},
    },
    async listEnrollments(classId) {
      enrollmentCalls.push(classId);
      if (options.failingListEnrollments) throw new Error('enrollment boom');
      return options.enrollments?.[classId] ?? [];
    },
    async getSession(sessionId) {
      sessionCalls.push(sessionId);
      if (options.failingGetSession) throw new Error('session boom');
      return options.sessions?.[sessionId] ?? null;
    },
  };

  return {
    deps,
    sentMessages,
    queriedUids,
    enrollmentCalls,
    sessionCalls,
    logMessages,
    errorMessages,
  };
}
