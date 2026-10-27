import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import RoleScreenHeader from '../../components/RoleScreenHeader';
import { useAttendance } from '../../state/AttendanceContext';
import { colors } from '../../theme';

export default function ScheduleListScreen() {
  const { activeRole } = useAttendance();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (activeRole === 'assistant') {
      router.replace('/assistant');
      return;
    }
    if (activeRole === 'praktikan') {
      router.replace('/praktikan');
      return;
    }
    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <RoleScreenHeader
        eyebrow="Kerangka navigasi"
        title="Daftar Jadwal"
        subtitle="Halaman ini akan dikembangkan oleh pemilik fitur jadwal."
        onBack={handleBack}
      />

      <View style={styles.body}>
        <FeaturePlaceholder
          title="Daftar Jadwal"
          description="Konten daftar jadwal dan detail sesi belum diimplementasikan pada halaman ini."
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
});
