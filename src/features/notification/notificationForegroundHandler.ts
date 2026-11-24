import { setNotificationHandler } from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

export function configureNotificationHandler(): void {
  if (Platform.OS !== 'android' || configured) return;

  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  configured = true;
}
