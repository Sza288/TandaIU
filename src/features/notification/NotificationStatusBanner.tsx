import { Linking } from 'react-native';
import ErrorRetryState from '../../components/ErrorRetryState';
import { useNotificationStatus } from '../../hooks/useNotificationStatus';

export default function NotificationStatusBanner() {
  const { content, retry } = useNotificationStatus();

  if (!content) return null;

  if (content.action === 'settings') {
    return (
      <ErrorRetryState
        message={content.message}
        retryLabel="Buka Pengaturan"
        onRetry={() => {
          void Linking.openSettings().catch(() => undefined);
        }}
      />
    );
  }

  if (content.action === 'retry') {
    return <ErrorRetryState message={content.message} onRetry={retry} />;
  }

  return <ErrorRetryState message={content.message} />;
}
