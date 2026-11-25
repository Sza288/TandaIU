import { StyleSheet, View } from 'react-native';
import ErrorRetryState from '../../components/ErrorRetryState';
import { spacing } from '../../theme';
import type { NotificationRegistrationStatus } from './notification.types';

type Props = {
  status: NotificationRegistrationStatus;
  reason: string | null;
  onRetry: () => void;
};

const FAILURE_STATUSES = new Set<NotificationRegistrationStatus>(['denied', 'error']);

export default function NotificationRegistrationBanner({ status, reason, onRetry }: Props) {
  if (!FAILURE_STATUSES.has(status)) return null;

  const message = reason?.trim()
    ? reason
    : status === 'denied'
      ? 'Izin notifikasi ditolak. Aktifkan notifikasi di pengaturan aplikasi, lalu coba lagi.'
      : 'Registrasi notifikasi gagal. Coba lagi.';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <ErrorRetryState message={message} onRetry={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    zIndex: 10,
  },
});
