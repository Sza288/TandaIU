import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import RoleScreenHeader from '../../components/RoleScreenHeader';
import { useAttendance } from '../../state/AttendanceContext';
import { colors } from '../../theme';
import { getPraktikanById } from '../../utils/academic';

export default function PraktikanHomeScreen() {
  const { activePraktikanId } = useAttendance();
  const praktikan = getPraktikanById(activePraktikanId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <RoleScreenHeader
        eyebrow="Peran Praktikan"
        title="Beranda Praktikan"
        subtitle={
          praktikan
            ? `${praktikan.name} · Semester ${praktikan.semester}`
            : 'Identitas praktikan belum dipilih.'
        }
      />

      <View style={styles.body}>
        <FeaturePlaceholder
          title="Dashboard Praktikan"
          description="Konten dashboard akan dikembangkan oleh pemilik fitur. Halaman ini hanya menyediakan struktur navigasi dasar."
          actionLabel="Buka Daftar Jadwal"
          onAction={() => router.push('/schedule')}
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
