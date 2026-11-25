import { getErrorMessage } from '../../utils/errorMessage';
import type { NotificationRegistrationStatus } from './notification.types';

export type NotificationStatusAction = 'settings' | 'retry' | null;

export type NotificationStatusContent = {
  message: string;
  action: NotificationStatusAction;
};

export type NotificationStatusInput = {
  status: NotificationRegistrationStatus;
  reason: string | null;
};

const PERMISSION_DENIED_MESSAGE =
  'Notifikasi dinonaktifkan. Pemberitahuan sesi dibuka, perubahan jadwal, dan hasil pengajuan izin tidak akan diterima. Aktifkan notifikasi melalui Pengaturan.';

const UNSUPPORTED_MESSAGE =
  'Notifikasi tidak didukung di perangkat ini. Fitur lain tetap dapat digunakan seperti biasa.';

export function getNotificationStatusContent({
  status,
  reason,
}: NotificationStatusInput): NotificationStatusContent | null {
  if (status === 'denied') {
    return { message: PERMISSION_DENIED_MESSAGE, action: 'settings' };
  }

  if (status === 'unsupported') {
    return { message: UNSUPPORTED_MESSAGE, action: null };
  }

  if (status === 'error' || (status === 'idle' && Boolean(reason?.trim()))) {
    return {
      message: reason?.trim() || getErrorMessage('unknown').message,
      action: 'retry',
    };
  }

  return null;
}
