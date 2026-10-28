import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import BottomNav from '../../components/BottomNav';
import SessionCard from '../../components/SessionCard';
import { getSessionIdsForPraktikan } from '../../data/sessionEnrollments';
import { useAttendance } from '../../state/AttendanceContext';
import { getPraktikanById } from '../../utils/academic';
import { colors, fonts, radius, shadows, spacing } from '../../theme';

export default function ScheduleListScreen() {
  const { sessions, attendances, activeRole, activePraktikanId } = useAttendance();
  const [query, setQuery] = useState('');
  const activePraktikan = getPraktikanById(activePraktikanId);
  const enrolledSessionIds = useMemo(
    () => new Set(activePraktikanId ? getSessionIdsForPraktikan(activePraktikanId) : []),
    [activePraktikanId],
  );
  const enrolledSessions = useMemo(
    () => sessions.filter((session) => enrolledSessionIds.has(session.id)),
    [enrolledSessionIds, sessions],
  );
  const visibleSessions = useMemo(() => {
    const roleSessions = activeRole === 'assistant'
      ? sessions
      : activeRole === 'praktikan'
        ? enrolledSessions
        : [];
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');

    return roleSessions.filter((session) =>
      [session.practicumName, session.className]
        .some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedQuery)),
    );
  }, [activeRole, enrolledSessions, query, sessions]);
  const outstandingAttendanceCount = activeRole === 'praktikan' && activePraktikanId
    ? enrolledSessions.filter((session) =>
      !attendances.some((attendance) =>
        attendance.sessionId === session.id && attendance.praktikanId === activePraktikanId,
      ),
    ).length
    : 0;
  const assistantScheduledCount = activeRole === 'assistant'
    ? sessions.filter((session) => session.status === 'terjadwal').length
    : 0;
  const missingIdentity = activeRole === 'praktikan' && !activePraktikanId;
  const missingRole = activeRole === null;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (activeRole === 'assistant') {
      router.replace('/assistant');
      return;
    }
    if (activeRole === 'praktikan') {
      router.replace('/praktikan');
      return;
    }
    router.replace('/home');
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
              {activeRole === 'assistant' ? 'PERAN ASISTEN' : activeRole === 'praktikan' ? 'PERAN PRAKTIKAN' : 'PILIH PERAN'}
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
            {activePraktikan ? `Halo, ${activePraktikan.name} 👋` : 'Pilih identitas praktikan'}
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
                ? 'Pilih peran terlebih dahulu untuk melihat jadwal praktikum.'
                : activeRole === 'praktikan'
                ? missingIdentity
                  ? 'Pilih identitas praktikan untuk melihat jadwal dan pengingat presensimu.'
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
              {missingRole ? 'Peran diperlukan' : missingIdentity ? 'Identitas diperlukan' : `${visibleSessions.length} sesi tersedia`}
            </Text>
          </View>
        </View>

        {missingRole ? (
          <EmptyScheduleState
            title="Peran belum dipilih"
            description="Pilih peran Asisten atau Praktikan untuk melihat jadwal yang sesuai."
          />
        ) : missingIdentity ? (
          <EmptyScheduleState
            title="Identitas praktikan belum dipilih"
            description="Pilih identitas dari menu Profil untuk melihat jadwal yang kamu ikuti."
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
