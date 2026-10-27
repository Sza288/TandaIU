import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import { colors } from '../../theme';

export default function RekapScreen() {
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FeaturePlaceholder
        title="Rekap Presensi"
        description="Konten rekap presensi akan dikembangkan oleh pemilik fitur asisten."
        actionLabel="Kembali"
        onAction={handleBack}
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
