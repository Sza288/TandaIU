import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav';
import FeaturePlaceholder from '../components/FeaturePlaceholder';
import { useAttendance } from '../state/AttendanceContext';
import { colors } from '../theme';

export default function ProfileScreen() {
  const { activeRole } = useAttendance();
  const roleLabel = activeRole === 'assistant' ? 'Asisten' : 'Praktikan';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FeaturePlaceholder
        title="Profil Menunggu Pengembangan"
        description={`Fitur profil ${roleLabel} sedang menunggu pengembangan.`}
      />
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

