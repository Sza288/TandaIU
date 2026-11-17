import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { useEnrollments } from '../../hooks/useEnrollments';
import { useReviews } from '../../hooks/useReview';
import { useSessions } from '../../hooks/useSessions';
import { submitReview } from '../../services/reviewService';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { PracticumSession } from '../../types';
import { formatDateTime } from '../../utils/format';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getAuthenticatedPraktikanIdentity } from '../praktikan/authenticatedIdentity';
import { Review } from './review.types';

const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 280;

type Feedback = {
  tone: 'success' | 'error';
  title: string;
  message: string;
};

const FEEDBACK_COLORS = {
  success: { backgroundColor: colors.successBg, borderColor: colors.success, icon: 'checkmark-circle' as const, iconColor: colors.success },
  error: { backgroundColor: colors.dangerBg, borderColor: colors.danger, icon: 'close-circle' as const, iconColor: colors.danger },
};

export default function PraktikanReviewScreen() {
  const reviews = useReviews();
  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const activePraktikan = getAuthenticatedPraktikanIdentity(profile);
  const studentId = activePraktikan?.id ?? null;
  const studentName = activePraktikan?.name ?? profile?.name ?? null;
  const hasIdentity = Boolean(studentId && studentName);
  const sessionResult = useSessions();
  const enrollmentResult = useEnrollments(
    studentId ? { praktikanId: studentId } : undefined,
  );
  const sessions = sessionResult.data;
  const enrolledClassIds = useMemo(
    () => new Set(enrollmentResult.data.map((enrollment) => enrollment.classId)),
    [enrollmentResult.data],
  );
  const sessionsLoading = sessionResult.loading || enrollmentResult.loading;
  const sessionsError = sessionResult.error ?? enrollmentResult.error;

  const eligibleSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.status === 'ditutup')
        .filter((session) => session.classId && enrolledClassIds.has(session.classId))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [enrolledClassIds, sessions],
  );

  const myReviews = useMemo(
    () =>
      reviews
        .filter((review) => review.studentId === studentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews, studentId],
  );

  const reviewedSessionIds = useMemo(
    () => new Set(myReviews.map((review) => review.sessionId)),
    [myReviews],
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
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
    if (reviewedSessionIds.has(session.id)) {
      setFeedback({
        tone: 'error',
        title: 'Ulasan sudah dikirim',
        message: 'Setiap sesi hanya dapat diulas satu kali.',
      });
      return;
    }
    setSessionId(session.id);
    setFeedback(null);
  };

  const handleSubmit = async () => {
    if (!sessionId) {
      setFeedback({
        tone: 'error',
        title: 'Sesi belum dipilih',
        message: 'Pilih sesi praktikum yang ingin kamu ulas.',
      });
      return;
    }
    if (!hasIdentity || !studentId || !studentName) {
      setFeedback({
        tone: 'error',
        title: 'Identitas belum siap',
        message: 'Profil akun belum lengkap untuk menulis ulasan.',
      });
      return;
    }
    if (!eligibleSessions.some((session) => session.id === sessionId)) {
      setFeedback({
        tone: 'error',
        title: 'Sesi belum selesai',
        message: 'Ulasan hanya dapat dikirim untuk sesi praktikum yang sudah ditutup.',
      });
      return;
    }
    if (reviewedSessionIds.has(sessionId)) {
      setFeedback({
        tone: 'error',
        title: 'Ulasan sudah dikirim',
        message: 'Setiap sesi hanya dapat diulas satu kali.',
      });
      return;
    }
    if (comment.trim().length < MIN_COMMENT_LENGTH) {
      setFeedback({
        tone: 'error',
        title: 'Ulasan terlalu singkat',
        message: `Tuliskan ulasan minimal ${MIN_COMMENT_LENGTH} karakter.`,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitReview({
        sessionId,
        studentId,
        studentName,
        comment,
      });

      if (!result.ok) {
        setFeedback({ tone: 'error', title: 'Ulasan gagal dikirim', message: result.reason });
        return;
      }

      setComment('');
      setSessionId(null);
      setFeedback({
        tone: 'success',
        title: 'Ulasan terkirim',
        message: 'Terima kasih, ulasanmu sudah tersimpan.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      setFeedback({ tone: 'error', title: 'Ulasan gagal dikirim', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Ulasan Praktikum"
        eyebrow="Peran Praktikan"
        onBack={handleBack}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {!profile ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="person-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Sesi belum tersedia</Text>
              <Text style={styles.emptyDescription}>
                Sesi autentikasi belum tersedia. Silakan masuk kembali untuk menulis ulasan.
              </Text>
            </View>
          ) : !hasIdentity ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="link-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Profil akun belum lengkap</Text>
              <Text style={styles.emptyDescription}>
                Profil akunmu belum memuat nama dan identitas yang dibutuhkan, jadi ulasan belum dapat dikirim.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sesi yang Sudah Selesai</Text>
                <Text style={styles.cardSubtitle}>
                  Ulasan hanya tersedia setelah sesi praktikum ditutup.
                </Text>

                {sessionsLoading ? (
                  <View style={styles.inlineLoading}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.hintText}>Memuat sesi dari Firestore...</Text>
                  </View>
                ) : sessionsError ? (
                  <Text style={styles.hintText}>{sessionsError}</Text>
                ) : eligibleSessions.length === 0 ? (
                  <Text style={styles.hintText}>
                    Belum ada sesi praktikum yang selesai untuk kelasmu.
                  </Text>
                ) : (
                  <View style={styles.sessionList}>
                    {eligibleSessions.map((session) => {
                      const selected = session.id === sessionId;
                      const reviewed = reviewedSessionIds.has(session.id);
                      return (
                        <TouchableOpacity
                          key={session.id}
                          style={[
                            styles.sessionOption,
                            selected && styles.sessionOptionSelected,
                            reviewed && styles.sessionOptionReviewed,
                          ]}
                          onPress={() => handleChooseSession(session)}
                          activeOpacity={0.85}
                          accessibilityRole="radio"
                          accessibilityState={{ selected, disabled: reviewed }}
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
                          {reviewed ? (
                            <Text style={styles.reviewedText}>Sudah diulas</Text>
                          ) : (
                            <Ionicons
                              name={selected ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={selected ? colors.primary : colors.textMuted}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Ulasan Praktikum</Text>
                  <TextInput
                    value={comment}
                    onChangeText={(value) => {
                      setComment(value);
                      if (feedback?.tone === 'error') setFeedback(null);
                    }}
                    placeholder="Contoh: Materi jelas, asisten sabar, dan praktikum menyenangkan."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={MAX_COMMENT_LENGTH}
                    editable={!submitting}
                    style={styles.input}
                    textAlignVertical="top"
                    accessibilityLabel="Ulasan praktikum"
                  />
                  <View style={styles.fieldFooter}>
                    <Text style={styles.hintText}>
                      Ulasan dianalisis otomatis oleh model sentimen di perangkat.
                    </Text>
                    <Text style={styles.counter}>
                      {comment.length}/{MAX_COMMENT_LENGTH}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={() => void handleSubmit()}
                  disabled={submitting}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Kirim ulasan praktikum"
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Ionicons name="paper-plane-outline" size={18} color={colors.textOnPrimary} />
                  )}
                  <Text style={styles.submitButtonText}>
                    {submitting ? 'Menganalisis sentimen...' : 'Kirim Ulasan'}
                  </Text>
                </TouchableOpacity>
              </View>

              {feedback ? <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} /> : null}

              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Ulasan Saya</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{myReviews.length}</Text>
                  </View>
                </View>

                {myReviews.length === 0 ? (
                  <View style={styles.emptyListCard}>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.primary} />
                    <Text style={styles.emptyListText}>
                      Belum ada ulasan. Ulasan yang kamu kirim akan muncul di sini.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.reviewList}>
                    {myReviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        session={sessionById.get(review.sessionId)}
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNav />
    </SafeAreaView>
  );
}

function ReviewCard({ review, session }: { review: Review; session?: PracticumSession }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <View style={styles.reviewCopy}>
          <Text style={styles.reviewTitle} numberOfLines={1}>
            {session?.practicumName ?? 'Sesi tidak ditemukan'}
          </Text>
          <Text style={styles.reviewMeta}>
            {session ? `Kelas ${session.className} · ` : ''}
            {formatDateTime(review.createdAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.reviewComment}>{review.comment}</Text>
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
  flex: {
    flex: 1,
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
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
  sessionOptionReviewed: {
    opacity: 0.7,
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
  reviewedText: {
    color: colors.success,
    fontFamily: fonts.bold,
    fontSize: 10,
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
  reviewList: {
    gap: spacing.sm,
  },
  reviewCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  reviewMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  reviewComment: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
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
