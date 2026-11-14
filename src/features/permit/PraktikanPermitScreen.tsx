import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import ScreenHeader from '../../components/ScreenHeader';
import { getSessionIdsForPraktikan } from '../../data/sessionEnrollments';
import { usePermits } from '../../hooks/usePermit';
import { submitPermit } from '../../services/permitService';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { PracticumSession } from '../../types';
import { getPraktikanById } from '../../utils/academic';
import { formatDateTime } from '../../utils/format';
import { Permit } from './permit.types';
import { PermitStatusBadge, SentimentBadge } from './PermitBadges';

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 280;

type Feedback = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
};

const FEEDBACK_COLORS = {
  success: { backgroundColor: colors.successBg, borderColor: colors.success, icon: 'checkmark-circle' as const, iconColor: colors.success },
  warning: { backgroundColor: colors.warningBg, borderColor: colors.warning, icon: 'alert-circle' as const, iconColor: colors.warning },
  error: { backgroundColor: colors.dangerBg, borderColor: colors.danger, icon: 'close-circle' as const, iconColor: colors.danger },
};

export default function PraktikanPermitScreen() {
  const { sessions, activePraktikanId } = useAttendance();
  const permits = usePermits();
  const activePraktikan = getPraktikanById(activePraktikanId);

  const eligibleSessions = useMemo(() => {
    if (!activePraktikanId) return [];
    const enrolledIds = new Set(getSessionIdsForPraktikan(activePraktikanId));
    return sessions
      .filter((session) => enrolledIds.has(session.id))
      .sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === 'dibuka') return -1;
          if (b.status === 'dibuka') return 1;
        }
        return b.startsAt.localeCompare(a.startsAt);
      });
  }, [activePraktikanId, sessions]);

  const myPermits = useMemo(
    () =>
      permits
        .filter((permit) => permit.studentId === activePraktikanId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activePraktikanId, permits],
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/praktikan');
  };

  const handleChooseSession = (session: PracticumSession) => {
    setSessionId(session.id);
    setFeedback(null);
  };

  const handleSubmit = async () => {
    if (!activePraktikanId || !activePraktikan) {
      setFeedback({
        tone: 'error',
        title: 'Identitas belum dipilih',
        message: 'Pilih identitas praktikan terlebih dahulu sebelum mengajukan izin.',
      });
      return;
    }
    if (!sessionId) {
      setFeedback({
        tone: 'error',
        title: 'Sesi belum dipilih',
        message: 'Pilih sesi praktikum yang ingin diajukan izinnya.',
      });
      return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setFeedback({
        tone: 'error',
        title: 'Alasan terlalu singkat',
        message: `Tuliskan alasan izin minimal ${MIN_REASON_LENGTH} karakter.`,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitPermit({
        sessionId,
        studentId: activePraktikanId,
        studentName: activePraktikan.name,
        reason,
      });

      if (!result.ok) {
        setFeedback({ tone: 'error', title: 'Pengajuan gagal', message: result.reason });
        return;
      }

      setReason('');
      const usedFallback = result.permit.sentimentSource === 'fallback';
      setFeedback({
        tone: usedFallback ? 'warning' : 'success',
        title: usedFallback ? 'Izin terkirim, sentimen memakai cadangan' : 'Pengajuan izin terkirim',
        message: usedFallback
          ? 'Model AI tidak mengenali teks alasan, jadi sistem memakai analisis cadangan. Asisten tetap dapat meninjau izinmu.'
          : `Sentimen alasan terdeteksi: ${result.permit.sentiment}. Asisten akan meninjau pengajuanmu.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      setFeedback({ tone: 'error', title: 'Pengajuan gagal', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Ajukan Izin"
        eyebrow="Peran Praktikan"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!activePraktikan ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="person-outline" size={26} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Identitas praktikan belum dipilih</Text>
            <Text style={styles.emptyDescription}>
              Pilih identitas praktikan terlebih dahulu agar pengajuan izin dapat dikirim.
            </Text>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => router.push('/role')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Pilih identitas praktikan"
            >
              <Text style={styles.primaryActionText}>Pilih Identitas</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sesi Praktikum</Text>
              <Text style={styles.cardSubtitle}>
                Pilih sesi yang ingin diajukan izinnya.
              </Text>

              {eligibleSessions.length === 0 ? (
                <Text style={styles.hintText}>
                  Belum ada sesi praktikum untuk kelasmu.
                </Text>
              ) : (
                <View style={styles.sessionList}>
                  {eligibleSessions.map((session) => {
                    const selected = session.id === sessionId;
                    return (
                      <TouchableOpacity
                        key={session.id}
                        style={[styles.sessionOption, selected && styles.sessionOptionSelected]}
                        onPress={() => handleChooseSession(session)}
                        activeOpacity={0.85}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Pilih sesi ${session.practicumName} kelas ${session.className}`}
                      >
                        <View style={styles.sessionCopy}>
                          <Text style={styles.sessionName} numberOfLines={1}>
                            {session.practicumName}
                          </Text>
                          <Text style={styles.sessionMeta}>
                            Kelas {session.className} · {formatDateTime(session.startsAt)}
                          </Text>
                        </View>
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={selected ? colors.primary : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Alasan Izin</Text>
                <TextInput
                  value={reason}
                  onChangeText={(value) => {
                    setReason(value);
                    if (feedback?.tone === 'error') setFeedback(null);
                  }}
                  placeholder="Contoh: Demam tinggi, harus istirahat sesuai surat dokter."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={MAX_REASON_LENGTH}
                  editable={!submitting}
                  style={styles.input}
                  textAlignVertical="top"
                  accessibilityLabel="Alasan izin"
                />
                <View style={styles.fieldFooter}>
                  <Text style={styles.hintText}>
                    Alasan dianalisis otomatis oleh model sentimen di perangkat.
                  </Text>
                  <Text style={styles.counter}>
                    {reason.length}/{MAX_REASON_LENGTH}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Kirim pengajuan izin"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Ionicons name="paper-plane-outline" size={18} color={colors.textOnPrimary} />
                )}
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Menganalisis sentimen...' : 'Kirim Pengajuan'}
                </Text>
              </TouchableOpacity>
            </View>

            {feedback ? <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} /> : null}

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Izin Saya</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{myPermits.length}</Text>
                </View>
              </View>

              {myPermits.length === 0 ? (
                <View style={styles.emptyListCard}>
                  <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                  <Text style={styles.emptyListText}>
                    Belum ada pengajuan izin. Status akan muncul di sini secara realtime.
                  </Text>
                </View>
              ) : (
                <View style={styles.permitList}>
                  {myPermits.map((permit) => (
                    <PermitCard
                      key={permit.id}
                      permit={permit}
                      session={sessionById.get(permit.sessionId)}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

function PermitCard({ permit, session }: { permit: Permit; session?: PracticumSession }) {
  return (
    <View style={styles.permitCard}>
      <View style={styles.permitTop}>
        <View style={styles.permitCopy}>
          <Text style={styles.permitTitle} numberOfLines={1}>
            {session?.practicumName ?? 'Sesi tidak ditemukan'}
          </Text>
          <Text style={styles.permitMeta}>
            {session ? `Kelas ${session.className} · ` : ''}
            {formatDateTime(permit.createdAt)}
          </Text>
        </View>
        <PermitStatusBadge status={permit.status} />
      </View>

      <Text style={styles.permitReason}>{permit.reason}</Text>

      <View style={styles.permitBadges}>
        <SentimentBadge sentiment={permit.sentiment} />
        {permit.sentimentSource === 'fallback' ? (
          <View style={styles.fallbackNote}>
            <Ionicons name="warning-outline" size={13} color={colors.warning} />
            <Text style={styles.fallbackText}>Analisis cadangan</Text>
          </View>
        ) : null}
      </View>

      {permit.status !== 'pending' && permit.reviewedAt ? (
        <Text style={styles.reviewText}>
          Direview {formatDateTime(permit.reviewedAt)}
          {permit.reviewedBy ? ` oleh ${permit.reviewedBy}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

function FeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: Feedback;
  onDismiss: () => void;
}) {
  const tone = FEEDBACK_COLORS[feedback.tone];
  return (
    <View
      style={[
        styles.feedback,
        { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={tone.icon} size={18} color={tone.iconColor} />
      <View style={styles.feedbackCopy}>
        <Text style={styles.feedbackTitle}>{feedback.title}</Text>
        <Text style={styles.feedbackMessage}>{feedback.message}</Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Tutup pesan"
        hitSlop={8}
      >
        <Ionicons name="close" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

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
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  cardTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  sessionOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sessionName: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 96,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  fieldFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  hintText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
  },
  counter: {
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  submitButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDark,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  feedbackCopy: {
    flex: 1,
    gap: 2,
  },
  feedbackTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  feedbackMessage: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
  },
  countText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  permitList: {
    gap: spacing.sm,
  },
  permitCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  permitTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  permitCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  permitTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  permitMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  permitReason: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  permitBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fallbackNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fallbackText: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  reviewText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
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
  primaryAction: {
    marginTop: spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryActionText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  emptyListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  emptyListText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
});
