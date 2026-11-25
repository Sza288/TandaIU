import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import BottomNav from '../../components/BottomNav';
import { useClasses } from '../../hooks/useClasses';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useSchedules } from '../../hooks/useSchedules';
import { useAuthSession } from '../auth/AuthSessionContext';
import { goBackOr } from '../crud/crud.utils';
import { getCourseById } from '../../utils/academic';
import type { ScheduleDoc } from '../../types/praktikum';
import { colors, fonts, radius, shadows, spacing } from '../../theme';

type DayKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const WEEKDAYS: DayKey[] = [1, 2, 3, 4, 5];

const DAY_LABEL: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

export default function ScheduleBoardScreen() {
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
  const classResult = useClasses({ classIds: enrolledClassIds });

  const classById = useMemo(
    () => new Map(classResult.data.map((item) => [item.id, item])),
    [classResult.data],
  );

  const groups = useMemo(() => {
    const byDay = new Map<DayKey, ScheduleDoc[]>();
    for (const schedule of scheduleResult.data) {
      if (!classById.has(schedule.classId)) continue;
      const day = schedule.dayOfWeek as DayKey;
      if (!WEEKDAYS.includes(day)) continue;
      const current = byDay.get(day) ?? [];
      current.push(schedule);
      byDay.set(day, current);
    }
    return WEEKDAYS
      .filter((day) => (byDay.get(day)?.length ?? 0) > 0)
      .map((day) => ({
        day,
        schedules: [...(byDay.get(day) ?? [])].sort(
          (a, b) => a.startTime.localeCompare(b.startTime),
        ),
      }));
  }, [classById, scheduleResult.data]);

  const loading = classResult.loading
    || scheduleResult.loading
    || (role === 'praktikan' && enrollmentResult.loading);
  const error = classResult.error
    ?? scheduleResult.error
    ?? (role === 'praktikan' ? enrollmentResult.error : null);

  const handleBack = () => goBackOr(router, role === 'praktikan' ? '/praktikan' : '/assistant');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            onPress={handleBack}
            style={styles.headerButton}
          >
            <Ionicons name="chevron-back" size={25} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              {role === 'asisten' ? 'PERAN ASISTEN' : role === 'praktikan' ? 'PERAN PRAKTIKAN' : 'JADWAL'}
            </Text>
            <Text style={styles.title}>Jadwal Mingguan</Text>
          </View>
          <View style={styles.headerBalance} />
        </View>

        <Text style={styles.subtitle}>
          Pola jadwal praktikum per hari. Ketuk jadwal untuk melihat sesi pertemuannya.
        </Text>

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
        ) : groups.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="calendar-clear-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Belum ada jadwal</Text>
            <Text style={styles.stateText}>
              Jadwal praktikum Senin sampai Jumat akan tampil di sini.
            </Text>
          </View>
        ) : (
          groups.map(({ day, schedules }) => (
            <View key={day} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{DAY_LABEL[day]}</Text>
                <View style={styles.dayLine} />
                <Text style={styles.dayCount}>{schedules.length}</Text>
              </View>

              {schedules.map((schedule) => {
                const classDoc = classById.get(schedule.classId);
                const courseName = getCourseById(schedule.courseId)?.name
                  ?? classDoc?.className
                  ?? 'Praktikum';

                return (
                  <Pressable
                    key={schedule.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Jadwal ${courseName}`}
                    onPress={() =>
                      router.push({
                        pathname: '/schedule/schedule/[id]',
                        params: { id: schedule.id },
                      })}
                    style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  >
                    <View style={styles.timeBlock}>
                      <Text style={styles.timeStart}>{schedule.startTime}</Text>
                      <Text style={styles.timeEnd}>{schedule.endTime}</Text>
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {courseName}
                      </Text>
                      <View style={styles.metaRow}>
                        <Ionicons name="school-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>
                          {classDoc ? `Kelas ${classDoc.className}` : 'Kelas tidak diketahui'}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText} numberOfLines={1}>{schedule.room}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="repeat-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>
                          {schedule.jumlahPertemuan
                            ? `${schedule.jumlahPertemuan} pertemuan`
                            : 'Jumlah pertemuan belum diisi'}
                        </Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ))
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
    fontSize: 17,
    textAlign: 'center',
  },
  headerBalance: {
    width: 44,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  daySection: {
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayLabel: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 15,
  },
  dayLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dayCount: {
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  timeBlock: {
    width: 52,
    alignItems: 'center',
    gap: 2,
  },
  timeStart: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 15,
  },
  timeEnd: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  cardDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
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
  pressed: {
    opacity: 0.85,
  },
});
