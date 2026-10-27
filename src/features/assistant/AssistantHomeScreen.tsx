import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import RoleScreenHeader from '../../components/RoleScreenHeader';
import { colors } from '../../theme';

export default function AssistantHomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <RoleScreenHeader
        eyebrow="Peran Asisten"
        title="Beranda Asisten"
        subtitle="Kerangka navigasi dasar untuk peran Asisten."
      />

      <View style={styles.body}>
        <FeaturePlaceholder
          title="Dashboard Asisten"
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
