import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import StatusBadge from '../../components/StatusBadge';
import { getPraktikanIdsForSession } from '../../data/sessionEnrollments';
import { praktikans } from '../../data/praktikans';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateLong, formatTimeRange } from '../../utils/format';
import { getCourseById } from '../../utils/academic';
import { getMeetingNumber } from '../../utils/session';
import AssistantAttendanceSummary from './AssistantAttendanceSummary';

export default function RekapScreen() {
  const { sessionId: rawParam } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

  const { sessions, attendances } = useAttendance();
  const session = sessions.find((s) => s.id === sessionId);
  const course = session ? getCourseById(session.courseId) : undefined;

  const enrolledPraktikans = useMemo(() => {
    if (!session) return [];
    const ids = getPraktikanIdsForSession(session.id);
    return ids
      .map((id) => praktikans.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  }, [session]);

  const handleBack = () => {
    if (router.canGoBack()) { router.back(); return; }
    router.replace('/assistant');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {session?.status === 'ditutup' ? (
          <>
            <View style={styles.sessionCard}>
              <View style={styles.sessionTop}>
                <View style={styles.sessionCopy}>
                  <Text style={styles.eyebrow}>DETAIL SESI</Text>
                  <Text style={styles.sessionTitle}>{session.practicumName}</Text>
                  <Text style={styles.sessionMeta}>
                    {course ? `Semester ${course.semester} · ` : ''}
                    Kelas {session.className} · Pertemuan {getMeetingNumber(session)}
                  </Text>
                </View>
                <StatusBadge status={session.status} />
              </View>

              <View style={styles.divider} />

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                  <Text style={styles.metaText}>{formatDateLong(session.startsAt)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={styles.metaText}>
                    {formatTimeRange(session.startsAt, session.endsAt)}
                  </Text>
                </View>
              </View>
            </View>

            <AssistantAttendanceSummary
              sessionId={session.id}
              sessionStatus={session.status}
              attendances={attendances}
              enrolledPraktikans={enrolledPraktikans}
            />
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {session
                ? 'Rekap belum tersedia'
                : sessionId
                  ? 'Sesi tidak ditemukan'
                  : 'Sesi belum dipilih'}
            </Text>
            <Text style={styles.emptyBody}>
              {session
                ? 'Rekap presensi dapat dilihat setelah sesi ditutup.'
                : 'Pilih sesi yang sudah ditutup dari riwayat untuk melihat rekap kehadiran.'}
            </Text>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>Kembali</Text>
            </TouchableOpacity>
          </View>
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
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  sessionCard: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadows.card,
  },
  sessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sessionCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  sessionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 24,
  },
  sessionMeta: {
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
  emptyCard: {
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginTop: spacing.md,
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
  backBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  backBtnText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
