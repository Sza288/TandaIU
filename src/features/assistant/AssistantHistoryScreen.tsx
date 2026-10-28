import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import StatusBadge from '../../components/StatusBadge';
import AssistantPageHeader from './AssistantPageHeader';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateLong, formatTimeRange } from '../../utils/format';
import { getCourseById } from '../../utils/academic';
import { getMeetingNumber } from '../../utils/session';

export default function AssistantHistoryScreen() {
  const { sessions } = useAttendance();

  const closedSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'ditutup')
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [sessions],
  );

  const goToDetail = (sessionId: string) => {
    router.push({ pathname: '/schedule/[id]', params: { id: sessionId } });
  };

  const goToRekap = (sessionId: string) => {
    router.push({ pathname: '/assistant/rekap/[sessionId]', params: { sessionId } });
  };

  const handleBack = () => {
    if (router.canGoBack()) { router.back(); return; }
    router.replace('/assistant');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AssistantPageHeader
        eyebrow="Peran Asisten"
        title="Riwayat Sesi"
        onBack={handleBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {closedSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Belum ada riwayat sesi</Text>
            <Text style={styles.emptyBody}>
              Sesi yang sudah ditutup akan muncul di sini beserta rekap kehadirannya.
            </Text>
          </View>
        ) : (
          closedSessions.map((session) => {
            const course = getCourseById(session.courseId);
            return (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardEyebrow}>
                      {course ? `Semester ${course.semester} · ` : ''}Pertemuan {getMeetingNumber(session)}
                    </Text>
                    <Text style={styles.cardTitle}>{session.practicumName}</Text>
                    <Text style={styles.cardMeta}>Kelas {session.className}</Text>
                  </View>
                  <StatusBadge status={session.status} />
                </View>

                <View style={styles.divider} />

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                    <Text style={styles.metaText}>{formatDateLong(session.startsAt)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={13} color={colors.primary} />
                    <Text style={styles.metaText}>
                      {formatTimeRange(session.startsAt, session.endsAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionBar}>
                  <TouchableOpacity
                    style={styles.btnOutline}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Detail ${session.practicumName}`}
                    onPress={() => goToDetail(session.id)}
                  >
                    <Ionicons name="eye-outline" size={14} color={colors.primaryDark} />
                    <Text style={styles.btnOutlineText}>Detail</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Rekap ${session.practicumName}`}
                    onPress={() => goToRekap(session.id)}
                  >
                    <Ionicons name="stats-chart-outline" size={14} color={colors.textOnPrimary} />
                    <Text style={styles.btnPrimaryText}>Lihat Rekap</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardEyebrow: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  actionBar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
  },
  btnOutlineText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
  },
  btnPrimaryText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  emptyCard: {
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadows.card,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
