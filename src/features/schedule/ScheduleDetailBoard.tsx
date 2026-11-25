
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SessionCard from '../../components/SessionCard';
import { useClasses } from '../../hooks/useClasses';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useSchedules } from '../../hooks/useSchedules';
import { useSessions } from '../../hooks/useSessions';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getCourseName, goBackOr } from '../crud/crud.utils';
import { colors, fonts, radius, shadows, spacing } from '../../theme';

const DAY_LABEL: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

export default function ScheduleDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const scheduleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const role = profile?.role ?? null;
  const praktikanId = role === 'praktikan' ? profile?.uid ?? null : null;

  const enrollmentResult = useEnrollments(
    praktikanId ? { praktikanId } : undefined,
  );
  const enrolledClassIds = useMemo(
    () => [...new Set(enrollmentResult.data.map((item) => item.classId))].sort(),
    [enrollmentResult.data],
  );
  const scheduleResult = useSchedules(
    role === 'praktikan' ? { classIds: enrolledClassIds } : undefined,
  );
  const sessionResult = useSessions();
  const classResult = useClasses();

  const schedule = scheduleResult.data.find((item) => item.id === scheduleId);
  const classDoc = schedule
    ? classResult.data.find((item) => item.id === schedule.classId)
    : undefined;

  const sessions = useMemo(
    () =>
      sessionResult.data
        .filter((session) => session.scheduleId === scheduleId)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [sessionResult.data, scheduleId],
  );

  const loading = scheduleResult.loading
    || sessionResult.loading
    || (role === 'praktikan' && enrollmentResult.loading);
  const error = scheduleResult.error
    ?? sessionResult.error
    ?? (role === 'praktikan' ? enrollmentResult.error : null);

  const handleBack = () => goBackOr(router, '/schedule');

  const title = schedule ? getCourseName(schedule.courseId) : 'Detail Jadwal';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={handleBack}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>JADWAL</Text>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.headerBalance} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Memuat jadwal...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
            <Text style={styles.stateTitle}>Jadwal tidak dapat dimuat</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : !schedule ? (
          <View style={styles.stateCard}>
            <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Jadwal tidak ditemukan</Text>
            <Text style={styles.stateText}>
              Jadwal ini mungkin sudah dihapus atau di luar kewenangan akun Anda.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  {DAY_LABEL[schedule.dayOfWeek] ?? 'Hari tidak valid'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  {schedule.startTime}–{schedule.endTime} WIB
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>{schedule.room}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  {classDoc ? `Kelas ${classDoc.className}` : schedule.classId}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sesi Pertemuan</Text>
              <Text style={styles.sectionCount}>{sessions.length} sesi</Text>
            </View>

            {sessions.length === 0 ? (
              <View style={styles.stateCard}>
                <Ionicons name="time-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.stateText}>
                  Belum ada sesi tertaut pada jadwal ini.
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {sessions.map((session) => (
                  <SessionCard key={session.id} session={session} role={role} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  title: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 16,
    textAlign: 'center',
  },
  headerBalance: {
    width: 44,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  infoCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 16,
  },
  sectionCount: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  list: {
    gap: spacing.md,
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  stateTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
