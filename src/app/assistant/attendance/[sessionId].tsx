import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AttendanceSummary from '../../../components/AttendanceSummary';
import ConfirmationModal from '../../../components/ConfirmationModal';
import ScreenHeader from '../../../components/ScreenHeader';
import StatusBadge from '../../../components/StatusBadge';
import {
  attendanceServiceMode,
  closeSession,
  openSession,
  subscribeToSession,
} from '../../../services/attendanceService';
import { colors, fonts, radius, shadows, spacing } from '../../../theme';
import type { PracticumSession } from '../../../types';
import { formatDateLong, formatTimeRange } from '../../../utils/format';

type PendingAction = 'open' | 'close';

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

export default function AssistantAttendanceDetailScreen() {
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;

  const [session, setSession] = useState<PracticumSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let active = true;

    const unsubscribe = subscribeToSession(
      sessionId,
      (record) => {
        if (!active) return;
        setSession(record);
        setLoading(false);
      },
      (message) => {
        if (!active) return;
        setError(message);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [sessionId, reloadKey]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/assistant/attendance' as Href);
  };

  const handleConfirm = async () => {
    if (!session || !pendingAction || submitting) return;
    const action = pendingAction;
    setPendingAction(null);
    setSubmitting(true);

    const result = action === 'open'
      ? await openSession(session.id)
      : await closeSession(session.id);

    setSubmitting(false);
    setFeedback({
      tone: result.ok ? 'success' : 'error',
      message: result.ok
        ? action === 'open'
          ? 'Sesi berhasil dibuka. Praktikan sekarang dapat melakukan presensi.'
          : 'Sesi berhasil ditutup. Presensi baru tidak dapat dilakukan.'
        : result.reason ?? 'Tindakan tidak berhasil. Silakan coba lagi.',
    });
  };

  const actionLabel = session?.status === 'terjadwal'
    ? 'Buka Sesi'
    : session?.status === 'dibuka'
      ? 'Tutup Sesi'
      : 'Sesi Ditutup';
  const actionDisabled = !session || session.status === 'ditutup' || submitting;
  const hints = session?.status === 'terjadwal'
    ? 'Sesi masih terjadwal. Buka sesi saat praktikum dimulai.'
    : session?.status === 'dibuka'
      ? 'Tutup sesi setelah praktikum selesai agar presensi tidak lagi diterima.'
      : 'Sesi sudah ditutup. Status ini tidak dapat dibuka kembali.';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader eyebrow="Asisten" title="Kelola Presensi" onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {attendanceServiceMode === 'mock' ? (
          <View style={styles.modeBanner}>
            <Ionicons name="flask-outline" size={16} color={colors.warning} />
            <Text style={styles.modeText}>
              Mode demo lokal aktif. Isi `.env` Firebase agar status sesi dan rekap tersinkron
              realtime.
            </Text>
          </View>
        ) : null}

        {!sessionId ? (
          <View style={styles.stateCard}>
            <Ionicons name="calendar-clear-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Sesi belum dipilih</Text>
            <Text style={styles.stateText}>
              Buka halaman presensi dari daftar sesi untuk memilih sesi praktikum.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Memuat sesi...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
            <Text style={styles.stateTitle}>Sesi tidak dapat dimuat</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Coba muat ulang sesi"
              onPress={() => {
                setLoading(true);
                setError(null);
                setReloadKey((value) => value + 1);
              }}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Coba Lagi</Text>
            </Pressable>
          </View>
        ) : !session ? (
          <View style={styles.stateCard}>
            <Ionicons name="calendar-clear-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Sesi tidak ditemukan</Text>
            <Text style={styles.stateText}>
              Sesi ini mungkin sudah dihapus. Kembali dan pilih sesi lain.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sessionCard}>
              <View style={styles.sessionTop}>
                <View style={styles.sessionCopy}>
                  <Text style={styles.eyebrow}>SESI PRAKTIKUM</Text>
                  <Text style={styles.sessionTitle}>{session.practicumName}</Text>
                  <Text style={styles.sessionMeta}>
                    Kelas {session.className} · {formatDateLong(session.startsAt)}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {formatTimeRange(session.startsAt, session.endsAt)}
                  </Text>
                </View>
                <StatusBadge status={session.status} />
              </View>

              <View style={styles.divider} />

              {feedback ? (
                <View
                  style={[
                    styles.feedback,
                    feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess,
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  <Ionicons
                    name={feedback.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={17}
                    color={feedback.tone === 'success' ? colors.success : colors.danger}
                  />
                  <Text
                    style={[
                      styles.feedbackText,
                      feedback.tone === 'error' ? styles.feedbackTextError : styles.feedbackTextSuccess,
                    ]}
                  >
                    {feedback.message}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.actionHint}>{hints}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                disabled={actionDisabled}
                onPress={() =>
                  setPendingAction(session.status === 'terjadwal' ? 'open' : 'close')
                }
                style={({ pressed }) => [
                  styles.actionButton,
                  session.status === 'dibuka' && styles.actionButtonDanger,
                  actionDisabled && styles.actionButtonDisabled,
                  pressed && !actionDisabled && styles.pressed,
                ]}
              >
                <Ionicons
                  name={
                    session.status === 'terjadwal'
                      ? 'lock-open-outline'
                      : session.status === 'dibuka'
                        ? 'lock-closed-outline'
                        : 'lock-closed'
                  }
                  size={20}
                  color={actionDisabled ? colors.textMuted : colors.textOnPrimary}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    actionDisabled && styles.actionButtonTextDisabled,
                  ]}
                >
                  {submitting ? 'Memproses...' : actionLabel}
                </Text>
              </Pressable>
            </View>

            <AttendanceSummary
              sessionId={session.id}
              title="Rekap Presensi Realtime"
              emptyMessage="Belum ada praktikan yang presensi. Rekap akan diperbarui otomatis saat presensi masuk."
            />
          </>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={pendingAction !== null}
        title={pendingAction === 'open' ? 'Buka sesi praktikum?' : 'Tutup sesi praktikum?'}
        message={
          pendingAction === 'open'
            ? 'Praktikan dapat melakukan presensi setelah sesi dibuka.'
            : 'Praktikan tidak dapat melakukan presensi setelah sesi ditutup.'
        }
        confirmLabel={pendingAction === 'open' ? 'Buka Sesi' : 'Tutup Sesi'}
        destructive={pendingAction === 'close'}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleConfirm()}
      />
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
  modeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warningBg,
    backgroundColor: colors.warningBg,
  },
  modeText: {
    flex: 1,
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
  },
  sessionCard: {
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
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
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
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  feedbackSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  feedbackError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  feedbackText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  feedbackTextSuccess: {
    color: colors.success,
  },
  feedbackTextError: {
    color: colors.danger,
  },
  actionHint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDark,
  },
  actionButtonDanger: {
    backgroundColor: colors.danger,
  },
  actionButtonDisabled: {
    backgroundColor: colors.neutralBg,
    borderWidth: 1,
    borderColor: colors.neutralBorder,
  },
  actionButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  actionButtonTextDisabled: {
    color: colors.neutral,
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
  retryButton: {
    minHeight: 36,
    marginTop: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  retryText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
  },
});
