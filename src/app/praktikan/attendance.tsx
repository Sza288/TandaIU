import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfirmationModal from '../../components/ConfirmationModal';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { getSessionIdsForPraktikan } from '../../data/sessionEnrollments';
import {
  attendanceServiceMode,
  checkIn,
  getAttendanceUser,
  subscribeToPraktikanAttendance,
  subscribeToSessions,
  type AttendanceRecord,
} from '../../services/attendanceService';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import type { PracticumSession } from '../../types';
import { formatDateLong, formatTime, formatTimeRange } from '../../utils/format';

const statusRank: Record<PracticumSession['status'], number> = {
  dibuka: 0,
  terjadwal: 1,
  ditutup: 2,
};

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

export default function PraktikanAttendanceScreen() {
  const currentUser = useMemo(() => getAttendanceUser(), []);
  const [sessions, setSessions] = useState<PracticumSession[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSession, setSelectedSession] = useState<PracticumSession | null>(null);
  const [submittingSessionId, setSubmittingSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribeSessions = subscribeToSessions(
      (records) => {
        if (!active) return;
        setSessions(records);
        setLoading(false);
      },
      (message) => {
        if (!active) return;
        setError(message);
        setLoading(false);
      },
    );

    const unsubscribeAttendance = subscribeToPraktikanAttendance(
      currentUser.uid,
      (records) => {
        if (!active) return;
        setAttendances(records);
      },
      (message) => {
        if (!active) return;
        setError(message);
      },
    );

    return () => {
      active = false;
      unsubscribeSessions();
      unsubscribeAttendance();
    };
  }, [currentUser.uid, reloadKey]);

  const attendanceBySession = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendances.forEach((record) => map.set(record.sessionId, record));
    return map;
  }, [attendances]);

  const visibleSessions = useMemo(() => {
    const enrolledIds = getSessionIdsForPraktikan(currentUser.uid);
    const scoped = enrolledIds.length > 0
      ? sessions.filter((session) => enrolledIds.includes(session.id))
      : sessions;

    return [...scoped].sort((a, b) => {
      const byStatus = statusRank[a.status] - statusRank[b.status];
      if (byStatus !== 0) return byStatus;
      return a.startsAt.localeCompare(b.startsAt);
    });
  }, [currentUser.uid, sessions]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/praktikan');
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedSession || submittingSessionId) return;
    const session = selectedSession;
    setSelectedSession(null);
    setSubmittingSessionId(session.id);

    const result = await checkIn(session.id, currentUser);
    setSubmittingSessionId(null);
    setFeedback({
      tone: result.ok ? 'success' : 'error',
      message: result.ok
        ? `Presensi ${session.practicumName} berhasil dicatat.`
        : result.reason ?? 'Presensi tidak berhasil. Silakan coba lagi.',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader eyebrow="Praktikan" title="Presensi" onBack={handleBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {attendanceServiceMode === 'mock' ? (
          <View style={styles.modeBanner}>
            <Ionicons name="flask-outline" size={16} color={colors.warning} />
            <Text style={styles.modeText}>
              Mode demo lokal aktif. Isi `.env` Firebase agar presensi tersimpan dan tersinkron
              realtime.
            </Text>
          </View>
        ) : null}

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {currentUser.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.identityName}>{currentUser.name}</Text>
            <Text style={styles.identityMeta}>
              {currentUser.studentCode ? `NIM ${currentUser.studentCode}` : currentUser.email}
            </Text>
          </View>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>Praktikan</Text>
          </View>
        </View>

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup pesan"
              hitSlop={8}
              onPress={() => setFeedback(null)}
            >
              <Ionicons name="close" size={15} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Sesi Praktikum</Text>
            <Text style={styles.sectionSubtitle}>
              Presensi hanya dapat dilakukan satu kali saat sesi dibuka.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Memuat sesi...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
            <Text style={styles.stateTitle}>Data presensi tidak dapat dimuat</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Coba muat ulang data presensi"
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
        ) : visibleSessions.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="calendar-clear-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Belum ada sesi praktikum</Text>
            <Text style={styles.stateText}>
              Sesi yang tersedia untuk kelasmu akan muncul di sini.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleSessions.map((session) => {
              const attendance = attendanceBySession.get(session.id);
              const alreadyCheckedIn = attendance !== undefined;
              const isOpen = session.status === 'dibuka';
              const disabled = alreadyCheckedIn || !isOpen || submittingSessionId !== null;

              const buttonLabel = alreadyCheckedIn
                ? 'Sudah Presensi'
                : isOpen
                  ? 'Presensi Sekarang'
                  : session.status === 'terjadwal'
                    ? 'Belum Dibuka'
                    : 'Sesi Ditutup';

              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionTop}>
                    <View style={styles.sessionIcon}>
                      <Ionicons name="school-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionTitle} numberOfLines={2}>
                        {session.practicumName}
                      </Text>
                      <Text style={styles.sessionMeta}>Kelas {session.className}</Text>
                    </View>
                    <StatusBadge status={session.status} />
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                      <Text style={styles.metaText}>{formatDateLong(session.startsAt)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={13} color={colors.primary} />
                      <Text style={styles.metaText}>
                        {formatTimeRange(session.startsAt, session.endsAt)}
                      </Text>
                    </View>
                  </View>

                  {alreadyCheckedIn ? (
                    <View style={styles.checkedInBanner}>
                      <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                      <Text style={styles.checkedInText}>
                        Presensi tercatat
                        {attendance.attendedAt
                          ? ` pukul ${formatTime(attendance.attendedAt)} WIB`
                          : ''}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${buttonLabel} untuk ${session.practicumName}`}
                    disabled={disabled}
                    onPress={() => setSelectedSession(session)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      disabled && styles.actionButtonDisabled,
                      pressed && !disabled && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={alreadyCheckedIn ? 'checkmark-circle' : 'checkmark-done-circle'}
                      size={18}
                      color={disabled ? colors.textMuted : colors.textOnPrimary}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        disabled && styles.actionButtonTextDisabled,
                      ]}
                    >
                      {submittingSessionId === session.id ? 'Memproses...' : buttonLabel}
                    </Text>
                  </Pressable>

                  {!alreadyCheckedIn && session.status === 'terjadwal' ? (
                    <Text style={styles.actionHint}>
                      Tombol aktif setelah asisten membuka sesi.
                    </Text>
                  ) : !alreadyCheckedIn && session.status === 'ditutup' ? (
                    <Text style={styles.actionHint}>
                      Sesi sudah ditutup, presensi tidak dapat dilakukan.
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={selectedSession !== null}
        title="Konfirmasi presensi"
        message={`Presensi ${selectedSession?.practicumName ?? 'praktikum'} sebagai ${currentUser.name}? Presensi hanya dapat dilakukan satu kali.`}
        confirmLabel="Presensi"
        onCancel={() => setSelectedSession(null)}
        onConfirm={() => void handleConfirmCheckIn()}
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
    gap: spacing.md,
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  identityName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  identityMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  rolePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  roleText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 10,
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
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionCopy: {
    flex: 1,
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
  list: {
    gap: spacing.md,
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
    gap: spacing.md,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
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
  sessionMeta: {
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
    gap: spacing.xs,
  },
  metaText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  checkedInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
    alignSelf: 'flex-start',
  },
  checkedInText: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  actionButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
  },
  actionButtonDisabled: {
    backgroundColor: colors.neutralBg,
    borderWidth: 1,
    borderColor: colors.neutralBorder,
  },
  actionButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  actionButtonTextDisabled: {
    color: colors.neutral,
  },
  actionHint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
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
