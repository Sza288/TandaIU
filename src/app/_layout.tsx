import { Comfortaa_700Bold } from '@expo-google-fonts/comfortaa/700Bold';
import { NunitoSans_400Regular } from '@expo-google-fonts/nunito-sans/400Regular';
import { NunitoSans_600SemiBold } from '@expo-google-fonts/nunito-sans/600SemiBold';
import { NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans/700Bold';
import { NunitoSans_800ExtraBold } from '@expo-google-fonts/nunito-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AttendanceProvider } from '../state/AttendanceContext';
import { colors, fonts } from '../theme';

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
    <AttendanceProvider>
      <StatusBar style="dark" />
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
        <Stack.Screen name="profile" options={{ title: 'Profil & Peran', headerShown: false }} />
        <Stack.Screen name="role" options={{ title: 'Pilih Peran', headerShown: false }} />
        <Stack.Screen name="assistant" options={{ title: 'Asisten', headerShown: false }} />
        <Stack.Screen name="praktikan" options={{ title: 'Praktikan', headerShown: false }} />
        <Stack.Screen name="schedule" options={{ title: 'Jadwal', headerShown: false }} />
        <Stack.Screen name="schedule/[id]" options={{ title: 'Detail Sesi' }} />
        <Stack.Screen
          name="assistant/riwayat"
          options={{ title: 'Riwayat Presensi', headerShown: false }}
        />
        <Stack.Screen
          name="assistant/rekap/[sessionId]"
          options={{ title: 'Rekap Presensi' }}
        />
        <Stack.Screen name="praktikan/riwayat" options={{ title: 'Riwayat Presensi' }} />
      </Stack>
    </AttendanceProvider>
  );
}
