import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useAttendance } from '../state/AttendanceContext';

export type MainTab = 'jadwal' | 'riwayat' | 'profil';

type Props = {
  active: MainTab;
};

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { key: MainTab; label: string; icon: IconName; activeIcon: IconName }[] = [
  { key: 'jadwal', label: 'Jadwal', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'riwayat', label: 'Riwayat', icon: 'time-outline', activeIcon: 'time' },
  { key: 'profil', label: 'Profil', icon: 'person-outline', activeIcon: 'person' },
];

export default function BottomNav({ active }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePraktikanId } = useAttendance();

  const handlePress = (tab: MainTab) => {
    if (tab === active) return;

    if (tab === 'jadwal') {
      router.push('/home');
      return;
    }
    if (tab === 'riwayat') {
      if (!activePraktikanId) {
        Alert.alert(
          'Riwayat Presensi',
          'Pilih identitas praktikan melalui menu Profil untuk melihat riwayat presensi.'
        );
        return;
      }
      router.push('/praktikan/riwayat');
      return;
    }
    router.push('/profile');
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            onPress={() => handlePress(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={18}
                color={isActive ? colors.textOnPrimary : colors.textSecondary}
              />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 34,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
