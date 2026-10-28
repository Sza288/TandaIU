import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import FeaturePlaceholder from '../../components/FeaturePlaceholder';
import RoleScreenHeader from '../../components/RoleScreenHeader';
import { colors } from '../../theme';

export default function HomeLandingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <RoleScreenHeader
        eyebrow="Kerangka navigasi"
        title="Jadwal"
        subtitle="Halaman jadwal akan dikembangkan oleh pemilik fitur."
      />

      <View style={styles.body}>
        <FeaturePlaceholder
          title="Daftar Jadwal"
          description="Konten jadwal praktikum belum diimplementasikan pada halaman ini."
        />
      </View>

      <BottomNav active="jadwal" />
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
