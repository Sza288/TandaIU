import type { PermitDecision } from './messages';

export type FirestoreData = Record<string, unknown>;

export type FirestoreChange<T extends FirestoreData = FirestoreData> = {
  before: T | null;
  after: T | null;
};

export const SCHEDULE_TRIGGER_FIELDS = [
  'classId',
  'courseId',
  'dayOfWeek',
  'startTime',
  'endTime',
  'room',
] as const;

export type ScheduleTriggerField = (typeof SCHEDULE_TRIGGER_FIELDS)[number];

const SCHEDULE_FIELD_LABELS: Record<ScheduleTriggerField, string> = {
  classId: 'Kelas',
  courseId: 'Mata kuliah',
  dayOfWeek: 'Hari',
  startTime: 'Jam mulai',
  endTime: 'Jam selesai',
  room: 'Ruangan',
};

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isSessionOpenedChange(change: FirestoreChange): boolean {
  return change.before?.status === 'terjadwal' && change.after?.status === 'dibuka';
}

export function getPermitResultStatus(change: FirestoreChange): PermitDecision | null {
  if (change.before?.status !== 'pending') return null;
  const status = change.after?.status;
  return status === 'approved' || status === 'rejected' ? status : null;
}

export function isPermitResultChange(change: FirestoreChange): boolean {
  return getPermitResultStatus(change) !== null;
}

export function changedScheduleFields(change: FirestoreChange): ScheduleTriggerField[] {
  if (!change.before || !change.after) return [];
  return SCHEDULE_TRIGGER_FIELDS.filter(
    (field) => !Object.is(change.before?.[field], change.after?.[field]),
  );
}

export function isScheduleChangedTrigger(change: FirestoreChange): boolean {
  return changedScheduleFields(change).length > 0;
}

export function describeScheduleChanges(fields: readonly ScheduleTriggerField[]): string[] {
  return fields.map((field) => `${SCHEDULE_FIELD_LABELS[field]} berubah`);
}

export function collectEnrollmentUids(
  enrollments: readonly FirestoreData[],
  classId: string,
): string[] {
  const target = readNonEmptyString(classId);
  if (!target) return [];

  const uids = new Set<string>();
  for (const enrollment of enrollments) {
    if (readNonEmptyString(enrollment.classId) !== target) continue;
    const uid = readNonEmptyString(enrollment.praktikanId);
    if (uid) uids.add(uid);
  }
  return [...uids];
}

export function collectScheduleRecipientUids(
  enrollments: readonly FirestoreData[],
  before: FirestoreData | null,
  after: FirestoreData | null,
): string[] {
  const classIds = new Set<string>();
  const beforeClassId = readNonEmptyString(before?.classId);
  const afterClassId = readNonEmptyString(after?.classId);
  if (beforeClassId) classIds.add(beforeClassId);
  if (afterClassId) classIds.add(afterClassId);

  const uids = new Set<string>();
  for (const classId of classIds) {
    for (const uid of collectEnrollmentUids(enrollments, classId)) uids.add(uid);
  }
  return [...uids];
}

export function collectPermitRecipientUid(permit: FirestoreData): string | null {
  return readNonEmptyString(permit.studentId);
}
