import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
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
import { useLaboratories } from '../../hooks/useLaboratories';
import { useSessions } from '../../hooks/useSessions';
import { db } from '../../lib/firebase';
import { useAuthSession } from '../auth/AuthSessionContext';
import { goBackOr } from '../crud/crud.utils';
import { COLLECTIONS, type ScheduleDoc } from '../../types/praktikum';
import { getCourseById } from '../../utils/academic';
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

function mapScheduleError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code.includes('permission-denied')) {
    return 'Anda tidak memiliki izin melihat jadwal ini';
  }
  if (code.includes('unavailable')) {
    return 'Koneksi bermasalah';
  }
  return 'Terjadi kesalahan saat memuat jadwal.';
}

export default function ScheduleDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const scheduleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const role = profile?.role ?? null;
  const authStatus = authSession?.status ?? 'loading';

  const sessionResult = useSessions();
  const laboratoryResult = useLaboratories();
  const [scheduleData, setScheduleData] = useState<ScheduleDoc | null>(null);
  const [scheduleErrorState, setScheduleErrorState] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const canLoadSchedule = Boolean(scheduleId) && authStatus === 'authenticated';

  useEffect(() => {
    if (!scheduleId || authStatus !== 'authenticated') return undefined;

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.schedules, scheduleId),
      (snapshot) => {
        setScheduleData(snapshot.exists()
          ? { id: snapshot.id, ...(snapshot.data() as Omit<ScheduleDoc, 'id'>) }
          : null);
        setScheduleErrorState(null);
        setResolvedKey(scheduleId);
      },
      (snapshotError) => {
        setScheduleData(null);
        setScheduleErrorState(mapScheduleError(snapshotError));
        setResolvedKey(scheduleId);
      },
    );
    return unsubscribe;
  }, [authStatus, scheduleId]);

  const schedule = resolvedKey === scheduleId ? scheduleData : null;
  const classResult = useClasses(schedule ? { classId: schedule.classId } : undefined);
  const scheduleError = resolvedKey === scheduleId ? scheduleErrorState : null;
  const classDoc = schedule
    ? classResult.data.find((item) => item.id === schedule.classId)
    : undefined;
  const visibleSchedule = schedule && classDoc ? schedule : null;
  const laboratoryName = visibleSchedule
    ? laboratoryResult.data.find((item) => item.id === visibleSchedule.laboratoryId)?.name
      ?? visibleSchedule.room
      ?? 'Laboratorium tidak diketahui'
    : '';

  const sessions = useMemo(
    () =>
      sessionResult.data
        .filter((session) => session.scheduleId === scheduleId)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [sessionResult.data, scheduleId],
  );

  const loading = authStatus === 'loading'
    || (canLoadSchedule && resolvedKey !== scheduleId)
    || sessionResult.loading
    || classResult.loading;
  const error = scheduleError ?? classResult.error ?? sessionResult.error;

  const handleBack = () => goBackOr(router, '/schedule');

  const title = schedule
    ? getCourseById(schedule.courseId)?.name ?? classDoc?.className ?? 'Detail Jadwal'
    : 'Detail Jadwal';

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
        ) : !visibleSchedule ? (
          <View style={styles.stateCard}>
            <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Jadwal tidak ditemukan</Text>
            <Text style={styles.stateText}>
              Jadwal ini sudah dihapus, kelasnya tidak tersedia, atau di luar kewenangan akun Anda.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleBack}
              style={styles.stateAction}
            >
              <Text style={styles.stateActionText}>Kembali ke Jadwal</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  {DAY_LABEL[visibleSchedule.dayOfWeek] ?? 'Hari tidak valid'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  {visibleSchedule.startTime}–{visibleSchedule.endTime} WIB
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>{laboratoryName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  {classDoc ? `Kelas ${classDoc.className}` : visibleSchedule.classId}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sesi Pertemuan</Text>
              <View style={styles.sectionActions}>
                {role === 'asisten' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tambah sesi"
                    onPress={() =>
                      router.push({
                        pathname: '/assistant/manage/schedule-generate',
                        params: { id: visibleSchedule.id },
                      })}
                    style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="add-circle-outline" size={15} color={colors.primaryDark} />
                    <Text style={styles.addButtonText}>Tambah Sesi</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.sectionCount}>{sessions.length} sesi</Text>
              </View>
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
                  <SessionCard
                    key={session.id}
                    session={session}
                    role={role}
                    sessions={sessions}
                  />
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
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 16,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  addButtonText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  pressed: {
    opacity: 0.7,
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
  stateAction: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  stateActionText: {
    color: colors.surface,
    fontFamily: fonts.semiBold,
    fontSize: 12,
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
