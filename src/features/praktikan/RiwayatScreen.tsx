import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import { colors } from '../../theme';

export default function RiwayatScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FeaturePlaceholder
        title="Riwayat Presensi"
        description="Konten riwayat presensi akan dikembangkan oleh pemilik fitur praktikan."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
