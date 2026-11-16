import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import ScreenHeader from '../../components/ScreenHeader';
import { assistantIdentity } from '../../data/assistantIdentity';
import { praktikans } from '../../data/praktikans';
import { useAuthSession } from '../auth/AuthSessionContext';
import { usePermits } from '../../hooks/usePermit';
import { reviewPermit, ReviewStatus } from '../../services/permitService';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { PracticumSession } from '../../types';
import { formatDateTime } from '../../utils/format';
import { Permit, PermitStatus } from './permit.types';
import { PermitStatusBadge } from './PermitBadges';

type FilterKey = 'all' | PermitStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
];

const STATUS_BY_FILTER: Record<Exclude<FilterKey, 'all'>, PermitStatus> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
};

export default function AssistantPermitsScreen() {
  const { sessions } = useAttendance();
  const permits = usePermits();
  const authSession = useAuthSession();
  const reviewerName =
    authSession?.status === 'authenticated' ? authSession.profile.name : assistantIdentity.name;
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  const counts = useMemo(
    () => ({
      pending: permits.filter((permit) => permit.status === 'pending').length,
      approved: permits.filter((permit) => permit.status === 'approved').length,
      rejected: permits.filter((permit) => permit.status === 'rejected').length,
    }),
    [permits],
  );

  const visiblePermits = useMemo(() => {
    const filtered = filter === 'all'
      ? permits
      : permits.filter((permit) => permit.status === STATUS_BY_FILTER[filter]);
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [filter, permits]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/assistant');
  };

  const runReview = async (permit: Permit, status: ReviewStatus) => {
    setReviewingId(permit.id);
    setFeedback(null);
    try {
      const result = await reviewPermit(permit.id, status, reviewerName);
      if (!result.ok) {
        setFeedback({ tone: 'error', message: result.reason });
        return;
      }
      setFeedback({
        tone: 'success',
        message: status === 'approved'
          ? `Izin ${permit.studentName} disetujui.`
          : `Izin ${permit.studentName} ditolak.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      setFeedback({ tone: 'error', message });
    } finally {
      setReviewingId(null);
    }
  };

  const confirmReview = (permit: Permit, status: ReviewStatus) => {
    Alert.alert(
      status === 'approved' ? 'Setujui pengajuan izin?' : 'Tolak pengajuan izin?',
      `${permit.studentName} akan melihat status ini secara realtime.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: status === 'approved' ? 'Setujui' : 'Tolak',
          style: status === 'approved' ? 'default' : 'destructive',
          onPress: () => void runReview(permit, status),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Review Izin"
        eyebrow="Asisten Praktikum"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <StatTile label="Menunggu" value={counts.pending} tone="warning" />
          <StatTile label="Disetujui" value={counts.approved} tone="success" />
          <StatTile label="Ditolak" value={counts.rejected} tone="danger" />
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item.key === filter;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(item.key)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter ${item.label}`}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {feedback ? (
          <View
            style={[
              styles.feedback,
              feedback.tone === 'success' ? styles.feedbackSuccess : styles.feedbackError,
            ]}
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name={feedback.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={feedback.tone === 'success' ? colors.success : colors.danger}
            />
            <Text style={styles.feedbackText}>{feedback.message}</Text>
          </View>
        ) : null}

        {visiblePermits.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Belum ada pengajuan izin</Text>
            <Text style={styles.emptyDescription}>
              Pengajuan dari praktikan akan muncul di sini secara realtime.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visiblePermits.map((permit) => {
              const session = sessionById.get(permit.sessionId);
              const student = praktikans.find((item) => item.id === permit.studentId);
              const isReviewing = reviewingId === permit.id;

              return (
                <PermitReviewCard
                  key={permit.id}
                  permit={permit}
                  session={session}
                  studentCode={student?.studentCode}
                  isReviewing={isReviewing}
                  onApprove={() => confirmReview(permit, 'approved')}
                  onReject={() => confirmReview(permit, 'rejected')}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

function PermitReviewCard({
  permit,
  session,
  studentCode,
  isReviewing,
  onApprove,
  onReject,
}: {
  permit: Permit;
  session?: PracticumSession;
  studentCode?: string;
  isReviewing: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{permit.studentName.charAt(0)}</Text>
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.studentName} numberOfLines={1}>
            {permit.studentName}
          </Text>
          <Text style={styles.cardMeta}>
            {studentCode ? `${studentCode} · ` : ''}
            {session?.practicumName ?? 'Sesi tidak ditemukan'}
            {session ? ` · Kelas ${session.className}` : ''}
          </Text>
        </View>
        <PermitStatusBadge status={permit.status} />
      </View>

      <Text style={styles.reasonLabel}>Alasan izin</Text>
      <Text style={styles.reason}>{permit.reason}</Text>

      <Text style={styles.timestamp}>
        Diajukan {formatDateTime(permit.createdAt)}
        {permit.reviewedAt ? ` · Direview ${formatDateTime(permit.reviewedAt)}` : ''}
      </Text>

      {permit.status === 'pending' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton, isReviewing && styles.actionDisabled]}
            onPress={onReject}
            disabled={isReviewing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Tolak izin ${permit.studentName}`}
          >
            <Ionicons name="close-circle-outline" size={17} color={colors.danger} />
            <Text style={styles.rejectText}>Tolak</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton, isReviewing && styles.actionDisabled]}
            onPress={onApprove}
            disabled={isReviewing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Setujui izin ${permit.studentName}`}
          >
            {isReviewing ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={17} color={colors.textOnPrimary} />
            )}
            <Text style={styles.approveText}>Setujui</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'success' | 'danger';
}) {
  return (
    <View style={[styles.statTile, STAT_TONES[tone]]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const STAT_TONES = {
  warning: { backgroundColor: colors.warningBg },
  success: { backgroundColor: colors.successBg },
  danger: { backgroundColor: colors.dangerBg },
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
  },
  statValue: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 19,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  filterTextActive: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  feedbackError: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  feedbackText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
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
    gap: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  studentName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  reasonLabel: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  reason: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  timestamp: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  approveButton: {
    backgroundColor: colors.primaryDark,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  rejectText: {
    color: colors.danger,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  approveText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  emptyCard: {
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
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
});
