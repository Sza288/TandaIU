export type NotificationMessage = { title: string; body: string };

export type PermitDecision = 'approved' | 'rejected';

export function resolvePracticumName(input: {
  practicumName?: unknown;
  courseId?: unknown;
}): string {
  const practicumName = typeof input.practicumName === 'string' ? input.practicumName.trim() : '';
  if (practicumName) return practicumName;

  const courseId = typeof input.courseId === 'string' ? input.courseId.trim() : '';
  return courseId || 'Praktikum';
}

function withClassName(name: string, className?: unknown): string {
  const normalized = typeof className === 'string' ? className.trim() : '';
  return normalized ? `${name} (${normalized})` : name;
}

export function buildSessionOpenedMessage(input: {
  practicumName?: unknown;
  courseId?: unknown;
  className?: unknown;
}): NotificationMessage {
  const subject = withClassName(resolvePracticumName(input), input.className);
  return { title: 'Sesi dibuka', body: `${subject} sudah dibuka.` };
}

export function buildScheduleChangedMessage(input: {
  practicumName?: unknown;
  courseId?: unknown;
  className?: unknown;
  changes?: readonly string[];
}): NotificationMessage {
  const subject = withClassName(resolvePracticumName(input), input.className);
  const changes = (input.changes ?? [])
    .map((change) => change.trim())
    .filter((change) => change.length > 0);
  const detail = changes.length > 0 ? changes.join(', ') : 'jadwal diperbarui';
  return { title: 'Jadwal berubah', body: `${subject}: ${detail}.` };
}

export function buildPermitResultMessage(input: {
  status: PermitDecision;
  practicumName?: unknown;
  courseId?: unknown;
  className?: unknown;
}): NotificationMessage {
  const subject = withClassName(resolvePracticumName(input), input.className);
  const statusLabel = input.status === 'approved' ? 'Disetujui' : 'Ditolak';
  return {
    title: 'Hasil pengajuan izin',
    body: `Pengajuan izinmu ${statusLabel} untuk ${subject}.`,
  };
}
