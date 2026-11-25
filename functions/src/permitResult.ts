import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createAdminDeps, createAdminLogger, describeError, type NotificationDeps } from './admin';
import { FUNCTIONS_REGION } from './config';
import { buildPermitResultMessage } from './messages';
import { buildNotificationData } from './payload';
import {
  collectPermitRecipientUid,
  getPermitResultStatus,
  isPermitResultChange,
  type FirestoreChange,
  type FirestoreData,
} from './recipients';
import { sendNotificationToUids } from './sendTokens';

export type PermitResultInput = {
  permitId: string;
  change: FirestoreChange;
};

export async function handlePermitResult(
  input: PermitResultInput,
  deps: NotificationDeps,
): Promise<void> {
  try {
    if (!isPermitResultChange(input.change)) return;

    const after = input.change.after;
    if (!after) return;

    const uid = collectPermitRecipientUid(after);
    if (!uid) return;

    const status = getPermitResultStatus(input.change);
    if (!status) return;

    const sessionId = typeof after.sessionId === 'string' ? after.sessionId : '';
    const session = await deps.getSession(sessionId);
    const message = buildPermitResultMessage({
      status,
      practicumName: session?.practicumName,
      courseId: session?.courseId ?? after.courseId,
      className: session?.className,
    });

    await sendNotificationToUids({
      uids: [uid],
      title: message.title,
      body: message.body,
      data: buildNotificationData({ type: 'permit_result', permitId: input.permitId }),
      sender: deps.sender,
      tokenStore: deps.tokenStore,
      logger: deps.logger,
    });
  } catch (error) {
    deps.logger.error(`permitResult gagal: ${describeError(error)}`);
  }
}

export const permitResult = onDocumentUpdated(
  { document: 'permits/{permitId}', region: FUNCTIONS_REGION },
  async (event) => {
    const logger = createAdminLogger();
    try {
      const before = (event.data?.before.data() ?? null) as FirestoreData | null;
      const after = (event.data?.after.data() ?? null) as FirestoreData | null;
      await handlePermitResult(
        { permitId: event.params.permitId, change: { before, after } },
        createAdminDeps(logger),
      );
    } catch (error) {
      logger.error(`permitResult gagal: ${describeError(error)}`);
    }
  },
);
