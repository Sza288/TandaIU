import { Comfortaa_700Bold } from '@expo-google-fonts/comfortaa/700Bold';
import { NunitoSans_400Regular } from '@expo-google-fonts/nunito-sans/400Regular';
import { NunitoSans_600SemiBold } from '@expo-google-fonts/nunito-sans/600SemiBold';
import { NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans/700Bold';
import { NunitoSans_800ExtraBold } from '@expo-google-fonts/nunito-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../features/auth/AuthSessionContext';
import AuthNavigationGate from '../features/auth/AuthNavigationGate';
import { useNotificationNavigation } from '../hooks/useNotificationNavigation';
import { useNotificationRegistration } from '../hooks/useNotificationRegistration';
import NotificationRegistrationBanner from '../features/notification/NotificationRegistrationBanner';
import { colors, fonts } from '../theme';

function NotificationRegistration() {
  const { status, reason, retry } = useNotificationRegistration();
  return <NotificationRegistrationBanner status={status} reason={reason} onRetry={retry} />;
}

function NotificationNavigation(): null {
  useNotificationNavigation();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Comfortaa_700Bold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <NotificationRegistration />
      <NotificationNavigation />
      <StatusBar style="dark" />
      <AuthNavigationGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.primary,
              headerTitleStyle: { fontFamily: fonts.bold, color: colors.primaryDeep },
              headerTitleAlign: 'center',
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ title: 'Profil', headerShown: false }} />
            <Stack.Screen name="assistant" options={{ title: 'Asisten', headerShown: false }} />
            <Stack.Screen name="praktikan" options={{ title: 'Praktikan', headerShown: false }} />
            <Stack.Screen name="maps" options={{ title: 'Maps Laboratorium', headerShown: false }} />
            <Stack.Screen name="schedule" options={{ title: 'Jadwal', headerShown: false }} />
            <Stack.Screen
              name="schedule/schedules"
              options={{ title: 'Jadwal Mingguan', headerShown: false }}
            />
            <Stack.Screen
              name="schedule/schedule/[id]"
              options={{ title: 'Detail Jadwal', headerShown: false }}
            />
            <Stack.Screen name="schedule/[id]" options={{ title: 'Detail Sesi' }} />
            <Stack.Screen
              name="assistant/riwayat"
              options={{ title: 'Riwayat Presensi', headerShown: false }}
            />
            <Stack.Screen
              name="assistant/rekap"
              options={{ title: 'Rekap per Kelas', headerShown: false }}
            />
            <Stack.Screen
              name="assistant/rekap/[sessionId]"
              options={{ title: 'Rekap Presensi' }}
            />
            <Stack.Screen
              name="assistant/rekap/kelas/[classId]"
              options={{ title: 'Rekap Kelas', headerShown: false }}
            />
            <Stack.Screen name="praktikan/riwayat" options={{ title: 'Riwayat Presensi' }} />
            <Stack.Screen
              name="assistant/permits"
              options={{ title: 'Review Izin', headerShown: false }}
            />
            <Stack.Screen
              name="praktikan/permit"
              options={{ title: 'Ajukan Izin', headerShown: false }}
            />
            <Stack.Screen
              name="praktikan/permit/[permitId]"
              options={{ title: 'Detail Izin', headerShown: false }}
            />
            <Stack.Screen
              name="assistant/reviews"
              options={{ title: 'Ulasan Praktikan', headerShown: false }}
            />
            <Stack.Screen
              name="praktikan/review"
              options={{ title: 'Ulasan Praktikum', headerShown: false }}
            />
            <Stack.Screen name="auth/login" options={{ headerShown: false }} />
            <Stack.Screen name="auth/register" options={{ headerShown: false }} />
          </Stack>
      </AuthNavigationGate>
    </AuthProvider>
  );
}
