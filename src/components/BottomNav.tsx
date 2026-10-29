import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAttendance } from '../state/AttendanceContext';
import { colors, fonts } from '../theme';

type MainTab = 'beranda' | 'jadwal' | 'riwayat' | 'profil';
type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { key: MainTab; label: string; icon: IconName; activeIcon: IconName }[] = [
  { key: 'beranda', label: 'Beranda', icon: 'home-outline', activeIcon: 'home' },
  { key: 'jadwal', label: 'Jadwal', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'riwayat', label: 'Riwayat', icon: 'time-outline', activeIcon: 'time' },
  { key: 'profil', label: 'Profil', icon: 'person-outline', activeIcon: 'person' },
];

function getActiveTab(pathname: string): MainTab {
  if (
    pathname === '/profile'
    || pathname.startsWith('/profile/')
  ) {
    return 'profil';
  }
  if (
    pathname === '/praktikan/riwayat'
    || pathname.startsWith('/assistant/riwayat')
    || pathname.startsWith('/assistant/rekap')
  ) {
    return 'riwayat';
  }
  if (pathname === '/schedule' || pathname.startsWith('/schedule/')) {
    return 'jadwal';
  }
  return 'beranda';
}

export default function BottomNav() {
  const routerPath = usePathname();
  const active = getActiveTab(routerPath);
  const insets = useSafeAreaInsets();
  const { activeRole } = useAttendance();

  const handlePress = (tab: MainTab) => {
    if (tab === active) return;

    if (tab === 'beranda') {
      if (activeRole === 'assistant') {
        router.replace('/assistant');
      } else if (activeRole === 'praktikan') {
        router.replace('/praktikan');
      } else {
        router.replace('/role');
      }
      return;
    }

    if (tab === 'jadwal') {
      if (!activeRole) {
        router.replace('/role');
        return;
      }
      router.replace('/schedule');
      return;
    }

    if (tab === 'riwayat') {
      if (activeRole === 'assistant') {
        router.replace('/assistant/riwayat');
      } else if (activeRole === 'praktikan') {
        router.replace('/praktikan/riwayat');
      } else {
        router.replace('/role');
      }
      return;
    }

    if (!activeRole) {
      Alert.alert('Profil', 'Pilih peran terlebih dahulu.');
      router.replace('/role');
      return;
    }
    router.replace('/profile');
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
                size={22}
                color={isActive ? colors.primaryDark : colors.textSecondary}
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
    borderTopColor: colors.borderStrong,
    paddingTop: 9,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingBottom: 2,
  },
  iconWrap: {
    width: 52,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primarySofter,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
