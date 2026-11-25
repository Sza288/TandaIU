import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createAdminDeps, createAdminLogger, describeError, type NotificationDeps } from './admin';
import { FUNCTIONS_REGION } from './config';
import { buildScheduleChangedMessage } from './messages';
import { buildNotificationData } from './payload';
import {
  changedScheduleFields,
  collectScheduleRecipientUids,
  describeScheduleChanges,
  isScheduleChangedTrigger,
  type FirestoreChange,
  type FirestoreData,
} from './recipients';
import { sendNotificationToUids } from './sendTokens';

export type ScheduleChangedInput = {
  scheduleId: string;
  change: FirestoreChange;
};

function readClassId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function handleScheduleChanged(
  input: ScheduleChangedInput,
  deps: NotificationDeps,
): Promise<void> {
  try {
    if (!isScheduleChangedTrigger(input.change)) return;

    const after = input.change.after;
    if (!after) return;

    const classIds = new Set<string>();
    const beforeClassId = readClassId(input.change.before?.classId);
    const afterClassId = readClassId(after.classId);
    if (beforeClassId) classIds.add(beforeClassId);
    if (afterClassId) classIds.add(afterClassId);

    const enrollments: FirestoreData[] = [];
    for (const classId of classIds) {
      enrollments.push(...(await deps.listEnrollments(classId)));
    }

    const uids = collectScheduleRecipientUids(enrollments, input.change.before, after);
    if (uids.length === 0) return;

    const message = buildScheduleChangedMessage({
      courseId: after.courseId,
      practicumName: after.practicumName,
      className: after.className,
      changes: describeScheduleChanges(changedScheduleFields(input.change)),
    });

    await sendNotificationToUids({
      uids,
      title: message.title,
      body: message.body,
      data: buildNotificationData({ type: 'schedule_changed', scheduleId: input.scheduleId }),
      sender: deps.sender,
      tokenStore: deps.tokenStore,
      logger: deps.logger,
    });
  } catch (error) {
    deps.logger.error(`scheduleChanged gagal: ${describeError(error)}`);
  }
}

export const scheduleChanged = onDocumentUpdated(
  { document: 'schedules/{scheduleId}', region: FUNCTIONS_REGION },
  async (event) => {
    const logger = createAdminLogger();
    try {
      const before = (event.data?.before.data() ?? null) as FirestoreData | null;
      const after = (event.data?.after.data() ?? null) as FirestoreData | null;
      await handleScheduleChanged(
        { scheduleId: event.params.scheduleId, change: { before, after } },
        createAdminDeps(logger),
      );
    } catch (error) {
      logger.error(`scheduleChanged gagal: ${describeError(error)}`);
    }
  },
);
