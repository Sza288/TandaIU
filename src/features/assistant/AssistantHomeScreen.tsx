import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import RoleScreenHeader from '../../components/RoleScreenHeader';
import { assistantIdentity } from '../../data/assistantIdentity';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function AssistantHomeScreen() {
  const { sessions } = useAttendance();

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === 'dibuka'),
    [sessions],
  );
  const closedSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'ditutup')
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [sessions],
  );

  const primaryActive = activeSessions[0];
  const defaultRecapSession = closedSessions[0];

  const goToSchedule = () => router.push('/schedule');

  const goToActiveSesi = () => {
    if (primaryActive) {
      router.push({ pathname: '/schedule/[id]', params: { id: primaryActive.id } });
    } else {
      router.push('/schedule');
    }
  };

  const goToRekap = () => {
    if (!defaultRecapSession) {
      Alert.alert('Rekap belum tersedia', 'Rekap dapat dilihat setelah sesi ditutup.');
      return;
    }
    router.push({
      pathname: '/assistant/rekap/[sessionId]',
      params: { sessionId: defaultRecapSession.id },
    });
  };

  const goToRiwayat = () => router.push('/assistant/riwayat');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RoleScreenHeader
          eyebrow="Asisten Praktikum"
          title="Dashboard Asisten"
          subtitle="Kelola sesi praktikum dan pantau kehadiran."
        />

        <View style={styles.identityCard}>
          <View style={styles.identityCopy}>
            <Text style={styles.greeting}>Halo, {assistantIdentity.name}!</Text>
            <Text style={styles.identityMeta}>{assistantIdentity.studentCode}</Text>
            <Text style={styles.identityMeta}>{assistantIdentity.role}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(assistantIdentity.name)}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile
            icon="book-outline"
            label="Jadwal Diampu"
            value={String(sessions.length)}
          />
          <StatTile
            icon="radio-button-on-outline"
            label="Sesi Aktif"
            value={String(activeSessions.length)}
          />
          <StatTile
            icon="checkmark-circle-outline"
            label="Selesai"
            value={String(closedSessions.length)}
          />
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Menu Cepat</Text>
        </View>
        <View style={styles.quickGrid}>
          <QuickCard
            icon="calendar-outline"
            title="Jadwal"
            caption="Lihat semua jadwal praktikum"
            onPress={goToSchedule}
          />
          <QuickCard
            icon="radio-button-on-outline"
            title="Sesi Aktif"
            caption="Praktikum yang sedang berlangsung"
            onPress={goToActiveSesi}
          />
          <QuickCard
            icon="stats-chart-outline"
            title="Rekap"
            caption="Lihat statistik kehadiran praktikum"
            onPress={() => goToRekap()}
          />
          <QuickCard
            icon="time-outline"
            title="Riwayat"
            caption="Praktikum yang telah selesai"
            onPress={goToRiwayat}
          />
        </View>

      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickCard({
  icon,
  title,
  caption,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.quickCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickCaption}>{caption}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },

  identityCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  identityCopy: { flex: 1, gap: spacing.xs },
  greeting: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  identityMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 15,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  statTile: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  statValue: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'center',
  },

  sectionRow: {
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 17,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  quickCard: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 92,
    padding: spacing.md,
    gap: 3,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  quickIcon: {
    width: 32,
    height: 32,
    alignSelf: 'center',
    marginBottom: 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  quickTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'center',
  },
  quickCaption: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },

});
