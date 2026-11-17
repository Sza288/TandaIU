import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import BottomNav from '../../components/BottomNav';
import SessionCard from '../../components/SessionCard';
import { usePraktikanAttendance } from '../../hooks/useAttendanceRecords';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useSessions } from '../../hooks/useSessions';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getAuthenticatedPraktikanIdentity } from '../praktikan/authenticatedIdentity';
import { colors, fonts, radius, shadows, spacing } from '../../theme';

export default function ScheduleListScreen() {
  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const activeRole = profile?.role ?? null;
  const activePraktikan = getAuthenticatedPraktikanIdentity(profile);
  const activePraktikanId = activeRole === 'praktikan' ? profile?.uid ?? null : null;
  const [query, setQuery] = useState('');

  const sessionResult = useSessions();
  const enrollmentResult = useEnrollments(
    activePraktikanId ? { praktikanId: activePraktikanId } : undefined,
  );
  const attendanceResult = usePraktikanAttendance(activePraktikanId);
  const sessions = sessionResult.data;
  const enrolledClassIds = new Set(enrollmentResult.data.map((enrollment) => enrollment.classId));
  const enrolledSessions = sessions.filter(
    (session) => session.classId && enrolledClassIds.has(session.classId),
  );
  const roleSessions = activeRole === 'asisten'
    ? sessions
    : activeRole === 'praktikan'
      ? enrolledSessions
      : [];
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
  const visibleSessions = roleSessions.filter((session) =>
    [session.practicumName, session.className]
      .some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedQuery)),
  );
  const attendedSessionIds = new Set(
    attendanceResult.data.map((attendance) => attendance.sessionId),
  );
  const outstandingAttendanceCount = activeRole === 'praktikan' && activePraktikanId
    ? enrolledSessions.filter((session) => !attendedSessionIds.has(session.id)).length
    : 0;
  const assistantScheduledCount = activeRole === 'asisten'
    ? sessions.filter((session) => session.status === 'terjadwal').length
    : 0;
  const loading = sessionResult.loading
    || (activeRole === 'praktikan' && enrollmentResult.loading)
    || (activeRole === 'praktikan' && attendanceResult.loading);
  const dataError = sessionResult.error
    ?? (activeRole === 'praktikan' ? enrollmentResult.error : null)
    ?? (activeRole === 'praktikan' ? attendanceResult.error : null);
  const missingEnrollmentMapping = activeRole === 'praktikan'
    && !loading
    && !dataError
    && enrollmentResult.data.length === 0;
  const missingRole = activeRole === null;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (activeRole === 'asisten') {
      router.replace('/assistant');
      return;
    }
    if (activeRole === 'praktikan') {
      router.replace('/praktikan');
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
              {activeRole === 'asisten' ? 'PERAN ASISTEN' : activeRole === 'praktikan' ? 'PERAN PRAKTIKAN' : 'JADWAL'}
            </Text>
            <Text style={styles.title}>Sesi Laboratorium</Text>
          </View>
          {activeRole === 'praktikan' && activePraktikan ? (
            <View style={styles.identityBadge}>
              <Text style={styles.identityInitial}>{activePraktikan.name.charAt(0)}</Text>
            </View>
          ) : (
            <View style={styles.headerBalance} />
          )}
        </View>

        {activeRole === 'praktikan' ? (
          <Text style={styles.greeting}>
            {activePraktikan ? `Halo, ${activePraktikan.name} 👋` : 'Jadwal akun praktikan'}
          </Text>
        ) : null}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={22} color={colors.primary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cari praktikum atau kelas..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Cari jadwal praktikum"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Hapus pencarian"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={21} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.reminderCard}>
          <View style={styles.reminderCopy}>
            <View style={styles.reminderTag}>
              <Ionicons name="notifications" size={15} color={colors.primaryDark} />
              <Text style={styles.reminderTagText}>REMINDER</Text>
            </View>
            <Text style={styles.reminderText}>
              {missingRole
                ? 'Sesi autentikasi belum tersedia. Silakan masuk kembali.'
                : activeRole === 'praktikan'
                ? loading
                  ? 'Memuat data pendaftaran dan jadwal praktikum...'
                  : dataError
                    ? 'Data pendaftaran atau jadwal belum dapat dimuat.'
                    : missingEnrollmentMapping
                      ? 'Data pendaftaran akun belum terhubung ke jadwal praktikum.'
                      : outstandingAttendanceCount > 0
                        ? `Ada ${outstandingAttendanceCount} sesi terdaftar yang belum kamu ikuti.`
                        : 'Kamu sudah mengikuti semua sesi yang terdaftar.'
                : assistantScheduledCount > 0
                  ? `${assistantScheduledCount} sesi masih terjadwal dan menunggu dibuka.`
                  : 'Tidak ada sesi terjadwal saat ini.'}
            </Text>
          </View>
          <View style={styles.reminderArtwork} pointerEvents="none">
            <Svg width="60" height="60" viewBox="0 0 72 72">
              <Path
                d="M12 17l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4zm48 32l1.5 3 3 1.5-3 1.5L60 58l-1.5-3-3-1.5 3-1.5L60 49z"
                fill={colors.primary}
                opacity={0.55}
              />
              <Circle cx="59" cy="16" r="2" fill={colors.primary} opacity={0.55} />
            </Svg>
            <Ionicons
              name="notifications-outline"
              size={56}
              color={colors.primaryDark}
              style={styles.reminderBell}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Jadwal Praktikum</Text>
            <Text style={styles.sectionSubtitle}>
              {missingRole
                ? 'Peran diperlukan'
                : loading
                  ? 'Memuat jadwal'
                  : dataError
                    ? 'Jadwal tidak dapat dimuat'
                    : missingEnrollmentMapping
                      ? 'Pendaftaran belum tersedia'
                      : `${visibleSessions.length} sesi tersedia`}
            </Text>
          </View>
        </View>

        {missingRole ? (
          <EmptyScheduleState
            title="Sesi belum tersedia"
            description="Silakan kembali ke Landing Page dan masuk kembali."
          />
        ) : loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Memuat jadwal dari Firestore...</Text>
          </View>
        ) : dataError ? (
          <EmptyScheduleState
            title="Jadwal tidak dapat dimuat"
            description={dataError}
          />
        ) : missingEnrollmentMapping ? (
          <EmptyScheduleState
            title="Jadwal akun belum terhubung"
            description="Data enrollment akun belum tersedia. Jadwal demo lokal tidak ditampilkan sebagai sesi terdaftar."
          />
        ) : visibleSessions.length === 0 ? (
          <EmptyScheduleState
            title={query.trim() ? 'Praktikum tidak ditemukan' : 'Belum ada jadwal praktikum'}
            description={query.trim()
              ? 'Coba kata kunci lain seperti nama praktikum atau kelas.'
              : activeRole === 'praktikan'
                ? 'Belum ada sesi yang terdaftar untuk identitas praktikan ini.'
                : 'Jadwal praktikum yang tersedia akan tampil di sini.'}
          />
        ) : (
          <View style={styles.list}>
            {visibleSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                role={activeRole}
              />
            ))}
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
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
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
  identityBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInitial: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  greeting: {
    marginTop: spacing.lg,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 21,
    lineHeight: 28,
  },
  searchBox: {
    minHeight: 48,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  reminderCard: {
    minHeight: 88,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    ...shadows.card,
  },
  reminderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  reminderArtwork: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBell: {
    position: 'absolute',
    opacity: 0.42,
  },
  reminderTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  reminderTagText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  reminderText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  sectionSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  list: {
    gap: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    marginBottom: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  emptyTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'center',
  },
  emptyDescription: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

function EmptyScheduleState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="calendar-outline" size={27} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}
