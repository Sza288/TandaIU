import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import PracticumIcon from '../../components/PracticumIcon';
import ScreenHeader from '../../components/ScreenHeader';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { getPraktikanById } from '../../utils/academic';
import { formatDateTime, getInitials } from '../../utils/format';
import { deriveRiwayat, RiwayatRecord } from './praktikan.utils';

export default function RiwayatScreen() {
  const { activePraktikanId, attendances, sessions } = useAttendance();
  const activePraktikan = getPraktikanById(activePraktikanId);

  const records = useMemo(
    () => deriveRiwayat(attendances, sessions, activePraktikanId),
    [activePraktikanId, attendances, sessions],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/praktikan');
  };

  const handleChooseIdentity = () => {
    router.push('/role');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Riwayat Presensi"
        eyebrow="Peran Praktikan"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!activePraktikanId ? (
          <EmptyState
            icon="person-outline"
            title="Identitas praktikan belum dipilih"
            description="Pilih identitas praktikan terlebih dahulu agar riwayat kehadiranmu dapat ditampilkan."
            actionLabel="Pilih Identitas"
            onAction={handleChooseIdentity}
          />
        ) : records.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="Belum ada riwayat presensi"
            description={`${
              activePraktikan?.name ?? 'Praktikan ini'
            } belum memiliki catatan kehadiran. Riwayat akan muncul setelah presensi pada sesi yang dibuka.`}
          />
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryAvatar}>
                <Text style={styles.summaryInitial}>
                  {activePraktikan ? getInitials(activePraktikan.name) : '?'}
                </Text>
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryName} numberOfLines={1}>
                  {activePraktikan?.name ?? 'Praktikan'}
                </Text>
                <Text style={styles.summaryMeta}>
                  {records.length} catatan kehadiran
                </Text>
              </View>
            </View>

            <View style={styles.list}>
              {records.map(({ attendance, session }) => (
                <HistoryCard
                  key={`${attendance.sessionId}-${attendance.praktikanId}`}
                  attendance={attendance}
                  session={session}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

function HistoryCard({ attendance, session }: RiwayatRecord) {
  const isExcused = attendance.status === 'izin';
  const statusLabel = isExcused ? 'Izin' : 'Hadir';
  const excuseLabel = attendance.excuseReason === 'sakit'
    ? 'Sakit'
    : attendance.excuseReason === 'izin-lainnya'
      ? 'Izin lainnya'
      : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <PracticumIcon practicumName={session?.practicumName ?? ''} size={22} />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {session?.practicumName ?? 'Sesi tidak ditemukan'}
          </Text>
          <Text style={styles.cardClass}>
            Kelas {session?.className ?? '-'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.timeItem}>
          <Ionicons name="time-outline" size={15} color={colors.primary} />
          <Text style={styles.timeText}>{formatDateTime(attendance.attendedAt)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            isExcused ? styles.statusIzin : styles.statusHadir,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isExcused ? styles.statusTextIzin : styles.statusTextHadir,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {isExcused && excuseLabel ? (
        <Text style={styles.excuseText}>Keterangan: {excuseLabel}</Text>
      ) : null}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.emptyAction}
          onPress={onAction}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  summaryCard: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  summaryAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  summaryInitial: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  summaryMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  list: {
    width: '100%',
    maxWidth: 720,
    gap: spacing.md,
  },
  card: {
    width: '100%',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  cardClass: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  timeText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusHadir: {
    backgroundColor: colors.successBg,
  },
  statusIzin: {
    backgroundColor: colors.warningBg,
  },
  statusText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  statusTextHadir: {
    color: colors.success,
  },
  statusTextIzin: {
    color: colors.warning,
  },
  excuseText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    marginBottom: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  emptyTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  emptyActionText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
