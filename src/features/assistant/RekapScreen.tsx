import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import { colors } from '../../theme';

export default function RekapScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FeaturePlaceholder
        title="Rekap Presensi"
        description="Konten rekap presensi akan dikembangkan oleh pemilik fitur asisten."
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
