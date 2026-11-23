import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatusBadge from '../../components/StatusBadge';
import { useClasses } from '../../hooks/useClasses';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useSessions } from '../../hooks/useSessions';
import { useSessionsAttendance } from '../../hooks/useAttendanceRecords';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateShort, formatTimeRange } from '../../utils/format';
import { getCourseName } from '../crud/crud.utils';
import AssistantPageHeader from './AssistantPageHeader';
import { buildClassRecap } from './assistant.utils';

export default function ClassRecapScreen() {
  const { classId: rawClassId } = useLocalSearchParams<{ classId?: string | string[] }>();
  const classId = Array.isArray(rawClassId) ? rawClassId[0] : rawClassId;

  const classResult = useClasses();
  const sessionResult = useSessions();
  const enrollmentResult = useEnrollments(classId ? { classId } : undefined);

  const classDoc = classResult.data.find((item) => item.id === classId);

  const classSessions = useMemo(
    () =>
      sessionResult.data
        .filter((session) => session.classId === classId)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [sessionResult.data, classId],
  );

  const sessionIds = useMemo(
    () => classSessions.map((session) => session.id),
    [classSessions],
  );

  const attendanceResult = useSessionsAttendance(sessionIds);

  const recap = useMemo(
    () =>
      buildClassRecap({
        sessions: classSessions,
        attendances: attendanceResult.data,
        enrollments: enrollmentResult.data,
      }),
    [classSessions, attendanceResult.data, enrollmentResult.data],
  );

  const loading = classResult.loading
    || sessionResult.loading
    || enrollmentResult.loading
    || attendanceResult.loading;
  const error = classResult.error
    ?? sessionResult.error
    ?? enrollmentResult.error
    ?? attendanceResult.error;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/assistant');
  };

  const title = classDoc ? `Kelas ${classDoc.className}` : 'Rekap Kelas';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AssistantPageHeader eyebrow="Peran Asisten" title={title} onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Memuat rekap kelas...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
            <Text style={styles.stateTitle}>Rekap tidak dapat dimuat</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : !classDoc ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Kelas tidak ditemukan</Text>
            <Text style={styles.stateText}>
              Kelas ini tidak tersedia atau berada di luar kewenangan akun Anda.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.eyebrow}>RINGKASAN KELAS</Text>
              <Text style={styles.courseName}>{getCourseName(classDoc.courseId)}</Text>
              <View style={styles.summaryRow}>
                <SummaryItem label="Pertemuan" value={recap.totalMeetings} />
                <SummaryItem label="Sudah Selesai" value={recap.closedMeetings} />
                <SummaryItem label="Praktikan" value={recap.students.length} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pertemuan</Text>
              {recap.meetings.length === 0 ? (
                <Text style={styles.emptyText}>
                  Belum ada sesi untuk kelas ini. Buat sesi lewat menu Kelola Praktikum.
                </Text>
              ) : (
                recap.meetings.map((meeting) => {
                  const hadir = attendanceResult.data.filter(
                    (record) => record.sessionId === meeting.sessionId && record.status !== 'izin',
                  ).length;
                  return (
                    <Pressable
                      key={meeting.sessionId}
                      accessibilityRole="button"
                      accessibilityLabel={`Lihat rekap pertemuan ${meeting.meetingNumber}`}
                      onPress={() =>
                        router.push({
                          pathname: '/assistant/rekap/[sessionId]',
                          params: { sessionId: meeting.sessionId },
                        })
                      }
                      style={({ pressed }) => [
                        styles.meetingRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.meetingCopy}>
                        <Text style={styles.meetingTitle}>
                          Pertemuan {meeting.meetingNumber}
                        </Text>
                        <Text style={styles.meetingMeta}>
                          {formatDateShort(meeting.startsAt)} ·{' '}
                          {formatTimeRange(meeting.startsAt, meeting.endsAt)}
                        </Text>
                      </View>
                      <View style={styles.meetingRight}>
                        <StatusBadge status={meeting.status} />
                        <Text style={styles.meetingHadir}>{hadir} hadir</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rekap Kehadiran</Text>
              <Text style={styles.cardSubtitle}>
                Alpha hanya dihitung pada pertemuan yang sudah ditutup.
              </Text>
              {recap.students.length === 0 ? (
                <Text style={styles.emptyText}>
                  Belum ada praktikan terdaftar pada kelas ini.
                </Text>
              ) : (
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHead]}>
                    <Text style={[styles.cellName, styles.headText]}>Nama</Text>
                    <Text style={[styles.cell, styles.headText]}>H</Text>
                    <Text style={[styles.cell, styles.headText]}>I</Text>
                    <Text style={[styles.cell, styles.headText]}>S</Text>
                    <Text style={[styles.cell, styles.headText]}>A</Text>
                    <Text style={[styles.cellRate, styles.headText]}>%</Text>
                  </View>
                  {recap.students.map((student) => (
                    <View key={student.praktikanId} style={styles.tableRow}>
                      <View style={styles.cellName}>
                        <Text style={styles.studentName} numberOfLines={1}>
                          {student.praktikanName}
                        </Text>
                        {student.studentCode ? (
                          <Text style={styles.studentCode}>{student.studentCode}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.cell}>{student.hadir}</Text>
                      <Text style={styles.cell}>{student.izin}</Text>
                      <Text style={styles.cell}>{student.sakit}</Text>
                      <Text style={styles.cell}>{student.alpha}</Text>
                      <Text style={[styles.cellRate, styles.rateText]}>
                        {Math.round(student.attendanceRate * 100)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.legend}>
                H = hadir · I = izin · S = sakit · A = alpha · % = persentase hadir
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
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
  summaryCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  courseName: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 23,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  summaryValue: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textAlign: 'center',
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
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  meetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  meetingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  meetingTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  meetingMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  meetingRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  meetingHadir: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  table: {
    gap: 0,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableHead: {
    borderTopWidth: 0,
  },
  headText: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  cellName: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  studentName: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  studentCode: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  cell: {
    width: 22,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  cellRate: {
    width: 34,
    textAlign: 'right',
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  rateText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  legend: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
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
  pressed: {
    opacity: 0.85,
  },
});
