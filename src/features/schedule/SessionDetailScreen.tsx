import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import { colors } from '../../theme';

export default function SessionDetailScreen() {
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
        title="Detail Sesi"
        description="Konten detail sesi akan dikembangkan oleh pemilik fitur jadwal."
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
