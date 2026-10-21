import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return <SafeAreaView style={styles.container}>
    <View style={styles.content}>
      <Text style={styles.title}>Presensi Praktikum</Text>
      <Text style={styles.description}>Kerangka aplikasi Expo siap. Implementasi fitur mengikuti SRS dan pembagian tugas tim.</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FC', justifyContent: 'center', padding: 24 },
  content: { gap: 12, alignItems: 'center' },
  title: { color: '#17253D', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  description: { color: '#64748B', fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
