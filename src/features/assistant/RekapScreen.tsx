
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
import AttendanceSummary from '../../components/AttendanceSummary';
import ConfirmationModal from '../../components/ConfirmationModal';
import StatusBadge from '../../components/StatusBadge';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useSessionAttendance } from '../../hooks/useAttendanceRecords';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useSessions } from '../../hooks/useSessions';
import {
  cancelAttendance,
  type AttendanceRecord,
} from '../../services/attendanceService';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateLong, formatTimeRange } from '../../utils/format';
import { getCourseById } from '../../utils/academic';
import { getMeetingNumber } from '../../utils/session';
import AssistantAttendanceSummary from './AssistantAttendanceSummary';

export default function RekapScreen() {
  const { sessionId: rawParam } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

  const sessionResult = useSessions();
  const session = sessionResult.data.find((s) => s.id === sessionId);
  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const canManageAttendance = Boolean(
    profile?.role === 'asisten' && profile.uid && session?.assistantUid === profile.uid,
  );
  const course = session ? getCourseById(session.courseId) : undefined;
  const enrollmentResult = useEnrollments(
    session?.classId ? { classId: session.classId } : undefined,
  );
  const attendanceResult = useSessionAttendance(sessionId);
  const summaryLoading = enrollmentResult.loading || attendanceResult.loading;
  const summaryError = enrollmentResult.error ?? attendanceResult.error;
  const [cancelRecord, setCancelRecord] = useState<AttendanceRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const enrolledPraktikans = useMemo(
    () =>
      enrollmentResult.data.map((enrollment) => ({
        id: enrollment.praktikanId,
        name: enrollment.praktikanName,
        studentCode: enrollment.studentCode,
        semester: enrollment.semester,
      })),
    [enrollmentResult.data],
  );

  const handleBack = () => {
    if (router.canGoBack()) { router.back(); return; }
    router.replace('/assistant');
  };

  const handleConfirmCancel = async () => {
    if (!session || !cancelRecord || cancelSubmitting) return;
    const record = cancelRecord;
    setCancelSubmitting(true);
    setCancelRecord(null);
    const result = await cancelAttendance(session.id, record.id, cancelReason);
    setCancelSubmitting(false);
    setCancelReason('');
    setCancelFeedback({
      tone: result.ok ? 'success' : 'error',
      message: result.ok
        ? `Presensi ${record.praktikanName} dibatalkan.`
        : result.reason ?? 'Pembatalan presensi tidak berhasil.',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sessionResult.loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptyTitle}>Memuat sesi...</Text>
            <Text style={styles.emptyBody}>Rekap diambil langsung dari Firestore.</Text>
          </View>
        ) : sessionResult.error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.danger} />
            <Text style={styles.emptyTitle}>Rekap tidak dapat dimuat</Text>
            <Text style={styles.emptyBody}>{sessionResult.error}</Text>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>Kembali</Text>
            </TouchableOpacity>
          </View>
        ) : session?.status === 'ditutup' ? (
          <>
            <View style={styles.sessionCard}>
              <View style={styles.sessionTop}>
                <View style={styles.sessionCopy}>
                  <Text style={styles.eyebrow}>DETAIL SESI</Text>
                  <Text style={styles.sessionTitle}>{session.practicumName}</Text>
                  <Text style={styles.sessionMeta}>
                    {course ? `Semester ${course.semester} · ` : ''}
                    Kelas {session.className} · Pertemuan {getMeetingNumber(session)}
                  </Text>
                </View>
                <StatusBadge status={session.status} />
              </View>

              <View style={styles.divider} />

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
            </View>

            {summaryLoading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.emptyBody}>Memuat data pendaftaran dan presensi...</Text>
              </View>
            ) : summaryError ? (
              <View style={styles.emptyCard}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.danger} />
                <Text style={styles.emptyTitle}>Rekap tidak dapat dimuat</Text>
                <Text style={styles.emptyBody}>{summaryError}</Text>
              </View>
            ) : (
              <AssistantAttendanceSummary
                sessionId={session.id}
                sessionStatus={session.status}
                attendances={attendanceResult.data}
                enrolledPraktikans={enrolledPraktikans}
              />
            )}
            {cancelFeedback ? (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.cancelFeedback,
                  cancelFeedback.tone === 'error' && styles.cancelFeedbackError,
                ]}
              >
                <Text style={styles.cancelFeedbackText}>{cancelFeedback.message}</Text>
              </View>
            ) : null}
            <AttendanceSummary
              sessionId={session.id}
              title="Detail Presensi Tersimpan"
              emptyMessage="Belum ada presensi yang dapat diperiksa."
              onCancelAttendance={canManageAttendance
                ? (record, reason) => {
                  setCancelRecord(record);
                  setCancelReason(reason);
                  setCancelFeedback(null);
                }
                : undefined}
            />
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {session
                ? 'Rekap belum tersedia'
                : sessionId
                  ? 'Sesi tidak ditemukan'
                  : 'Sesi belum dipilih'}
            </Text>
            <Text style={styles.emptyBody}>
              {session
                ? 'Rekap presensi dapat dilihat setelah sesi ditutup.'
                : 'Pilih sesi yang sudah ditutup dari riwayat untuk melihat rekap kehadiran.'}
            </Text>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>Kembali</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <BottomNav />
      <ConfirmationModal
        visible={cancelRecord !== null}
        title="Batalkan presensi praktikan?"
        message={
          cancelRecord
            ? `Presensi ${cancelRecord.praktikanName} akan dibatalkan dan tidak dihitung hadir.`
            : 'Presensi akan dibatalkan.'
        }
        confirmLabel={cancelSubmitting ? 'Memproses...' : 'Batalkan Presensi'}
        destructive
        onCancel={() => {
          setCancelRecord(null);
          setCancelReason('');
        }}
        onConfirm={() => void handleConfirmCancel()}
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
  sessionCard: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadows.card,
  },
  sessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sessionCopy: {
    flex: 1,
    gap: 2,
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
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  emptyCard: {
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    ...shadows.card,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  cancelFeedback: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
  },
  cancelFeedbackError: {
    backgroundColor: colors.dangerBg,
  },
  cancelFeedbackText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
  },
  backBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  backBtnText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
