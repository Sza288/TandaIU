import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createAdminDeps, createAdminLogger, describeError, type NotificationDeps } from './admin';
import { FUNCTIONS_REGION } from './config';
import { buildSessionOpenedMessage } from './messages';
import { buildNotificationData } from './payload';
import {
  collectEnrollmentUids,
  isSessionOpenedChange,
  type FirestoreChange,
  type FirestoreData,
} from './recipients';
import { sendNotificationToUids } from './sendTokens';

export type SessionOpenedInput = {
  sessionId: string;
  change: FirestoreChange;
};

export async function handleSessionOpened(
  input: SessionOpenedInput,
  deps: NotificationDeps,
): Promise<void> {
  try {
    if (!isSessionOpenedChange(input.change)) return;

    const after = input.change.after;
    if (!after) return;

    const classId = typeof after.classId === 'string' ? after.classId : '';
    const uids = collectEnrollmentUids(await deps.listEnrollments(classId), classId);
    if (uids.length === 0) return;

    const message = buildSessionOpenedMessage({
      practicumName: after.practicumName,
      courseId: after.courseId,
      className: after.className,
    });

    await sendNotificationToUids({
      uids,
      title: message.title,
      body: message.body,
      data: buildNotificationData({ type: 'session_opened', sessionId: input.sessionId }),
      sender: deps.sender,
      tokenStore: deps.tokenStore,
      logger: deps.logger,
    });
  } catch (error) {
    deps.logger.error(`sessionOpened gagal: ${describeError(error)}`);
  }
}

export const sessionOpened = onDocumentUpdated(
  { document: 'sessions/{sessionId}', region: FUNCTIONS_REGION },
  async (event) => {
    const logger = createAdminLogger();
    try {
      const before = (event.data?.before.data() ?? null) as FirestoreData | null;
      const after = (event.data?.after.data() ?? null) as FirestoreData | null;
      await handleSessionOpened(
        { sessionId: event.params.sessionId, change: { before, after } },
        createAdminDeps(logger),
      );
    } catch (error) {
      logger.error(`sessionOpened gagal: ${describeError(error)}`);
    }
  },
);
