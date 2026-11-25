import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import PracticumIcon from '../../components/PracticumIcon';
import RoleScreenHeader from '../../components/RoleScreenHeader';
import SessionCard from '../../components/SessionCard';
import StatusBadge from '../../components/StatusBadge';
import { usePraktikanAttendance } from '../../hooks/useAttendanceRecords';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useSessions } from '../../hooks/useSessions';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { PracticumSession } from '../../types';
import { formatDateLong, formatTimeRange, getInitials } from '../../utils/format';
import { getAuthenticatedPraktikanIdentity } from './authenticatedIdentity';
import { deriveOpenSessions } from './praktikan.utils';

export default function PraktikanHomeScreen() {
  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const activePraktikan = getAuthenticatedPraktikanIdentity(profile);
  const activePraktikanId = profile?.role === 'praktikan' ? profile.uid : null;
  const sessionResult = useSessions();
  const enrollmentResult = useEnrollments(
    activePraktikanId ? { praktikanId: activePraktikanId } : undefined,
  );
  const attendanceResult = usePraktikanAttendance(activePraktikanId);
  const enrolledClassIds = new Set(
    enrollmentResult.data.map((enrollment) => enrollment.classId),
  );
  const enrolledSessions = sessionResult.data.filter(
    (session) => session.classId && enrolledClassIds.has(session.classId),
  );
  const enrolledSessionIds = new Set(enrolledSessions.map((session) => session.id));
  const openSessions = deriveOpenSessions(
    enrolledSessions,
    attendanceResult.data,
    activePraktikanId,
    enrolledSessionIds,
  );
  const enrollmentLoading = enrollmentResult.loading || sessionResult.loading;
  const enrollmentError = enrollmentResult.error ?? sessionResult.error ?? attendanceResult.error;
  const hasEnrollment = enrollmentResult.data.length > 0;

  const handleOpenSchedule = () => router.push('/schedule');
  const handleOpenHistory = () => router.push('/praktikan/riwayat');
  const handleOpenPermit = () => router.push('/praktikan/permit');
  const handleOpenReview = () => router.push('/praktikan/review');
  const handleOpenMaps = () => router.push('/maps');
  const handleOpenSession = (sessionId: string) => {
    router.push({ pathname: '/schedule/[id]', params: { id: sessionId } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <RoleScreenHeader
        eyebrow="Peran Praktikan"
        title="Beranda Praktikan"
        subtitle="Pantau sesi yang sedang dibuka dan kehadiranmu."
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {activePraktikan ? (
            <View style={styles.identityCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(activePraktikan.name)}</Text>
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.greeting} numberOfLines={1}>
                  Halo, {activePraktikan.name}!
                </Text>
                {activePraktikan.studentCode ? (
                  <Text style={styles.identityMeta}>{activePraktikan.studentCode}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
          {!activePraktikan ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="person-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Profil praktikan belum tersedia</Text>
              <Text style={styles.emptyDescription}>
                Data profil akun belum tersedia. Coba muat ulang sesi atau masuk kembali.
              </Text>
            </View>
          ) : null}

          {activePraktikan ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pintasan</Text>
              <View style={styles.quickGrid}>
                <QuickCard
                  icon="calendar-outline"
                  title="Sesi"
                  caption="Lihat semua sesi praktikum"
                  onPress={handleOpenSchedule}
                />
                <QuickCard
                  icon="time-outline"
                  title="Riwayat"
                  caption="Lihat catatan kehadiranmu"
                  onPress={handleOpenHistory}
                />
                <QuickCard
                  icon="document-text-outline"
                  title="Ajukan Izin"
                  caption="Kirim izin dan pantau statusnya"
                  onPress={handleOpenPermit}
                />
                <QuickCard
                  icon="chatbubble-ellipses-outline"
                  title="Ulasan"
                  caption="Beri ulasan setelah praktikum selesai"
                  onPress={handleOpenReview}
                />
                <QuickCard
                  icon="map-outline"
                  title="Maps"
                  caption="Lokasi dan aktivitas laboratorium"
                  onPress={handleOpenMaps}
                />
              </View>
            </View>
          ) : null}

          {activePraktikan ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>Sesi Menunggu Presensi</Text>
                  <Text style={styles.sectionSubtitle}>
                    Sesi terbuka yang belum kamu ikuti.
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{openSessions.length}</Text>
                </View>
              </View>

              {enrollmentLoading ? (
                <View style={styles.emptySessionCard}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.emptySessionDescription}>
                    Memuat sesi dan data pendaftaran dari Firestore...
                  </Text>
                </View>
              ) : enrollmentError ? (
                <View style={styles.emptySessionCard}>
                  <View style={styles.emptySessionIcon}>
                    <Ionicons name="cloud-offline-outline" size={24} color={colors.danger} />
                  </View>
                  <Text style={styles.emptySessionTitle}>Jadwal tidak dapat dimuat</Text>
                  <Text style={styles.emptySessionDescription}>{enrollmentError}</Text>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() => {
                      sessionResult.retry();
                      enrollmentResult.retry();
                      attendanceResult.retry();
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Coba muat ulang jadwal"
                  >
                    <Text style={styles.secondaryActionText}>Coba Lagi</Text>
                  </TouchableOpacity>
                </View>
              ) : openSessions.length === 0 ? (
                <View style={styles.emptySessionCard}>
                  <View style={styles.emptySessionIcon}>
                    <Ionicons name="calendar-clear-outline" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.emptySessionTitle}>
                    Tidak ada sesi terbuka yang menunggu presensi
                  </Text>
                  <Text style={styles.emptySessionDescription}>
                    {hasEnrollment
                      ? 'Saat ini tidak ada sesi terbuka yang belum kamu ikuti.'
                      : 'Data enrollment akun belum tersedia. Hubungi asisten untuk menghubungkan akun ke kelas praktikum.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={handleOpenSchedule}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Lihat jadwal praktikum"
                  >
                    <Text style={styles.secondaryActionText}>Lihat Jadwal</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.sessionList}>
                  {openSessions.map((session) => (
                    <OpenSessionCard
                      key={session.id}
                      session={session}
                      onPress={() => handleOpenSession(session.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {activePraktikan && hasEnrollment ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>Sesi Praktikum Saya</Text>
                  <Text style={styles.sectionSubtitle}>
                    Seluruh sesi dari kelas yang kamu ikuti.
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{enrolledSessions.length}</Text>
                </View>
              </View>

              {enrolledSessions.length === 0 ? (
                <View style={styles.emptySessionCard}>
                  <View style={styles.emptySessionIcon}>
                    <Ionicons name="calendar-clear-outline" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.emptySessionTitle}>Belum ada sesi untuk kelasmu</Text>
                  <Text style={styles.emptySessionDescription}>
                    Sesi akan muncul di sini setelah asisten membuatnya untuk kelas yang kamu ikuti.
                  </Text>
                </View>
              ) : (
                <View style={styles.sessionList}>
                  {enrolledSessions.map((item) => (
                    <SessionCard
                      key={item.id}
                      session={item}
                      role="praktikan"
                      sessions={enrolledSessions}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

function OpenSessionCard({
  session,
  onPress,
}: {
  session: PracticumSession;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Lihat sesi ${session.practicumName}, kelas ${session.className}`}
    >
      <View style={styles.sessionTop}>
        <View style={styles.sessionIcon}>
          <PracticumIcon practicumName={session.practicumName} size={22} />
        </View>
        <View style={styles.sessionCopy}>
          <Text style={styles.sessionTitle} numberOfLines={2}>
            {session.practicumName}
          </Text>
          <Text style={styles.sessionClass}>Kelas {session.className}</Text>
        </View>
        <StatusBadge status={session.status} />
      </View>

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

      <View style={styles.sessionFooter}>
        <Text style={styles.pendingText}>Belum presensi</Text>
        <View style={styles.sessionAction}>
          <Text style={styles.sessionActionText}>Lihat Sesi</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  body: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  identityCard: {
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
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
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
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
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryAction: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryActionText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  section: {
    width: '100%',
    gap: spacing.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  countText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  sessionList: {
    width: '100%',
    gap: spacing.md,
  },
  sessionCard: {
    width: '100%',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sessionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  sessionClass: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  metaText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  sessionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pendingText: {
    color: colors.warning,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  sessionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sessionActionText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  emptySessionCard: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  emptySessionIcon: {
    width: 46,
    height: 46,
    marginBottom: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  emptySessionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'center',
  },
  emptySessionDescription: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  secondaryAction: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  secondaryActionText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 96,
    alignItems: 'center',
    padding: spacing.md,
    gap: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  quickIcon: {
    width: 32,
    height: 32,
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
    lineHeight: 14,
    textAlign: 'center',
  },
});
