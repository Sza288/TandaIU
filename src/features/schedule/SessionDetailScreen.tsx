
import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams, type ExternalPathString } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import AttendanceDetailModal from '../../components/AttendanceDetailModal';
import AttendanceLocationDetails from '../../components/AttendanceLocationDetails';
import BottomNav from '../../components/BottomNav';
import ConfirmationModal from '../../components/ConfirmationModal';
import { SupportContactCard } from '../../components/DashboardWidgets';
import StatusBadge from '../../components/StatusBadge';
import { useSessionAttendance } from '../../hooks/useAttendanceRecords';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useSessions } from '../../hooks/useSessions';
import type { CurrentUser } from '../../lib/currentSession';
import {
  cancelAttendance,
  checkIn,
  closeSession,
  openSession,
  type AttendanceRecord,
} from '../../services/attendanceService';
import type { EnrollmentRecord } from '../../services/enrollmentService';
import { useAuthSession } from '../auth/AuthSessionContext';
import { formatDateLong, formatTime } from '../../utils/format';
import { getLabLabel, getMeetingNumber } from '../../utils/session';
import { getCourseById } from '../../utils/academic';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import type { MutationResult } from '../../types';
import { acquireDeviceLocation } from '../../utils/location';
import { createAttendanceLink } from '../../utils/attendanceLink';

type PendingSessionAction = 'open' | 'close' | 'checkin';

type ActionFeedback = {
  tone: 'success' | 'error';
  title: string;
  message: string;
};

class QrRenderBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[attendance-link] QR rendering failed', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function SessionDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const authSession = useAuthSession();
  const profile = authSession?.status === 'authenticated' ? authSession.profile : null;
  const activeRole = profile?.role ?? null;
  const activePraktikanId = activeRole === 'praktikan' ? profile?.uid ?? null : null;
  const sessionResult = useSessions();
  const session = sessionResult.data.find((item) => item.id === sessionId);
  const attendanceLink = session ? createAttendanceLink(session.id) : '';
  const sessionCourse = session ? getCourseById(session.courseId) : undefined;
  const isAssistant = activeRole === 'asisten';
  const praktikanEnrollmentResult = useEnrollments(
    activePraktikanId ? { praktikanId: activePraktikanId } : undefined,
  );
  const classEnrollmentResult = useEnrollments(
    isAssistant && session?.classId ? { classId: session.classId } : undefined,
  );
  const attendanceResult = useSessionAttendance(sessionId, activePraktikanId);
  const currentUser = useMemo<CurrentUser | null>(() => {
    if (!profile) return null;
    return {
      uid: profile.uid,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      ...(profile.studentCode ? { studentCode: profile.studentCode } : {}),
    };
  }, [profile]);
  const activeAttendance = attendanceResult.data.find(
    (attendance) => attendance.praktikanId === activePraktikanId,
  );
  const isEnrolledPraktikan = Boolean(
    activePraktikanId
    && session?.classId
    && praktikanEnrollmentResult.data.some(
      (enrollment) => enrollment.classId === session.classId,
    ),
  );
  const detailScrollRef = useRef<ScrollViewInstance | null>(null);
  const rosterOffset = useRef(0);
  const [statusCardSize, setStatusCardSize] = useState({ width: 0, height: 0 });
  const enrolledPraktikans: EnrollmentRecord[] = classEnrollmentResult.data;
  const enrolledIds = new Set(enrolledPraktikans.map((praktikan) => praktikan.praktikanId));
  const attendanceByPraktikan = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceResult.data.forEach((attendance) => {
      if (!enrolledIds.size || enrolledIds.has(attendance.praktikanId)) {
        map.set(attendance.praktikanId, attendance);
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceResult.data, enrolledPraktikans]);
  /**
   * Roster asisten. Data utama dari enrollment kelas; bila query enrollment
   * ditolak Firestore Rules, presensi yang sudah tercatat tetap ditampilkan
   * agar check-in praktikan tidak tampak hilang.
   */
  const rosterEntries = useMemo(() => {
    const entries: {
      praktikanId: string;
      praktikanName: string;
      semester?: number;
    }[] = enrolledPraktikans.map((praktikan) => ({
      praktikanId: praktikan.praktikanId,
      praktikanName: praktikan.praktikanName,
      semester: praktikan.semester,
    }));
    const known = new Set(entries.map((entry) => entry.praktikanId));
    attendanceByPraktikan.forEach((attendance, praktikanId) => {
      if (known.has(praktikanId)) return;
      entries.push({
        praktikanId,
        praktikanName: attendance.praktikanName,
      });
    });
    return entries;
  }, [enrolledPraktikans, attendanceByPraktikan]);
  const presentPraktikans = rosterEntries.filter((praktikan) => {
    const attendance = attendanceByPraktikan.get(praktikan.praktikanId);
    return attendance?.status === 'hadir';
  });
  const sickPraktikans = rosterEntries.filter((praktikan) => {
    const attendance = attendanceByPraktikan.get(praktikan.praktikanId);
    return attendance?.status === 'izin' && attendance.excuseReason === 'sakit';
  });
  const excusedPraktikans = rosterEntries.filter((praktikan) => {
    const attendance = attendanceByPraktikan.get(praktikan.praktikanId);
    return attendance?.status === 'izin' && attendance.excuseReason !== 'sakit';
  });
  const notRecordedPraktikans = rosterEntries.filter(
    (praktikan) => {
      const attendance = attendanceByPraktikan.get(praktikan.praktikanId);
      return !attendance || attendance.status === 'dibatalkan';
    },
  );
  const enrollmentTotalKnown = enrolledPraktikans.length > 0;
  const presentPercentage = enrolledPraktikans.length === 0
    ? 0
    : (presentPraktikans.length / enrolledPraktikans.length) * 100;
  const recordedPercentage = enrolledPraktikans.length === 0
    ? 0
    : ((presentPraktikans.length + excusedPraktikans.length) / enrolledPraktikans.length) * 100;

  const diagKey = `${sessionId ?? ''}|${attendanceResult.data.length}|${enrolledPraktikans.length}|${rosterEntries.length}`;
  useEffect(() => {
    if (!isAssistant) return;
    if (typeof console === 'undefined') return;
    console.log('[detail-sesi]', {
      sessionId,
      sesiStatus: session?.status ?? null,
      attendanceDiterima: attendanceResult.data.length,
      attendanceLoading: attendanceResult.loading,
      attendanceError: attendanceResult.error,
      enrollmentDiterima: enrolledPraktikans.length,
      enrollmentLoading: classEnrollmentResult.loading,
      enrollmentError: classEnrollmentResult.error,
      lolosFilter: attendanceByPraktikan.size,
      rosterTerbentuk: rosterEntries.length,
      hadir: presentPraktikans.length,
      izin: excusedPraktikans.length,
      sakit: sickPraktikans.length,
      belum: notRecordedPraktikans.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagKey]);
  const alreadyCheckedIn =
    activeAttendance !== undefined && activeAttendance.status !== 'dibatalkan';
  const enrollmentLoading = isAssistant
    ? classEnrollmentResult.loading
    : praktikanEnrollmentResult.loading;
  const enrollmentError = isAssistant
    ? classEnrollmentResult.error
    : praktikanEnrollmentResult.error;
  const [pendingAction, setPendingAction] = useState<PendingSessionAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceRecord | null>(null);
  const [cancelRecord, setCancelRecord] = useState<AttendanceRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const canManageAttendance = Boolean(
    isAssistant && profile?.uid && session?.assistantUid === profile.uid,
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/schedule');
  };

  const showActionResult = (
    result: MutationResult,
    successTitle: string,
    successMessage: string,
  ) => {
    setActionFeedback({
      tone: result.ok ? 'success' : 'error',
      title: result.ok ? successTitle : 'Tindakan tidak berhasil',
      message: result.ok ? successMessage : result.reason ?? 'Silakan coba lagi.',
    });
  };

  const handleAssistantAction = () => {
    if (!session || submittingAction) return;
    if (session.status === 'terjadwal') {
      setActionFeedback(null);
      setPendingAction('open');
      return;
    }
    if (session.status === 'dibuka') {
      setActionFeedback(null);
      setPendingAction('close');
    }
  };

  const handlePractikanAction = () => {
    if (
      !session
      || session.status !== 'dibuka'
      || !activePraktikanId
      || !isEnrolledPraktikan
      || alreadyCheckedIn
      || enrollmentLoading
      || enrollmentError
      || attendanceResult.loading
      || submittingAction
    ) return;
    setActionFeedback(null);
    setPendingAction('checkin');
  };

  const handleConfirmAction = async () => {
    const action = pendingAction;
    if (!session || !action || submittingAction) return;
    setPendingAction(null);

    if (action === 'open') {
      setSubmittingAction(true);
      const result = await openSession(session.id);
      setSubmittingAction(false);
      showActionResult(result, 'Sesi dibuka', 'Status sesi sudah diperbarui.');
      return;
    }
    if (action === 'close') {
      setSubmittingAction(true);
      const result = await closeSession(session.id);
      setSubmittingAction(false);
      showActionResult(result, 'Sesi ditutup', 'Sesi praktikum berhasil ditutup.');
      return;
    }
    if (!currentUser || !isEnrolledPraktikan) {
      showActionResult(
        { ok: false, reason: 'Enrollment sesi ini belum terverifikasi.' },
        '',
        '',
      );
      return;
    }

    setSubmittingAction(true);
    const location = await acquireDeviceLocation();
    if (!location.ok) {
      setSubmittingAction(false);
      showActionResult(
        { ok: false, reason: location.reason },
        '',
        '',
      );
      return;
    }
    const result = await checkIn(session.id, currentUser, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracyMeters,
    });
    setSubmittingAction(false);
    const locationDetails = [
      typeof result.distanceMeters === 'number'
        ? `Jarak ${Math.round(result.distanceMeters)} meter dari laboratorium`
        : '',
      typeof result.radiusMeters === 'number'
        ? `radius ${Math.round(result.radiusMeters)} meter`
        : '',
      typeof result.accuracyMeters === 'number'
        ? `akurasi ${Math.round(result.accuracyMeters)} meter`
        : '',
    ].filter(Boolean).join(', ');
    showActionResult(
      result,
      'Presensi berhasil.',
      result.ok ? locationDetails : '',
    );
  };

  const handleConfirmCancel = async () => {
    if (!session || !cancelRecord || submittingAction) return;
    const record = cancelRecord;
    const reason = cancelReason;
    setCancelRecord(null);
    setCancelReason('');
    setSubmittingAction(true);
    const result = await cancelAttendance(session.id, record.id, reason);
    setSubmittingAction(false);
    showActionResult(
      result,
      'Presensi dibatalkan',
      result.ok ? `Presensi ${record.praktikanName} tidak lagi dihitung hadir.` : '',
    );
  };

  const handleRequestCancel = (record: AttendanceRecord, reason: string) => {
    setCancelRecord(record);
    setCancelReason(reason);
  };

  const shareAttendanceLink = async () => {
    if (!session) return;
    const link = attendanceLink;

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined') {
          Alert.alert('Link tidak dapat dibagikan', 'Fitur berbagi tidak tersedia di browser ini.');
          return;
        }
        if (typeof navigator.share === 'function') {
          await navigator.share({ title: `Presensi ${session.practicumName}`, url: link });
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
          Alert.alert('Link disalin', 'Link presensi berhasil disalin ke clipboard.');
          return;
        }
        Alert.alert(
          'Link tidak dapat dibagikan',
          'Browser ini tidak mendukung fitur berbagi atau clipboard.',
        );
        return;
      }

      await Share.share(
        { message: link, title: `Presensi ${session.practicumName}` },
        { dialogTitle: 'Bagikan link presensi' },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
      Alert.alert('Link tidak dapat dibagikan', message);
    }
  };

  const buttonLabel = isAssistant
    ? submittingAction
      ? 'Memproses...'
      : session?.status === 'terjadwal'
        ? 'Buka Sesi Praktikum'
        : session?.status === 'dibuka'
          ? 'Tutup Sesi Presensi'
          : 'Sesi Telah Ditutup'
    : activeRole === null
      ? 'Masuk kembali untuk melanjutkan'
    : !activePraktikanId
      ? 'Data pendaftaran akun belum tersedia'
    : enrollmentLoading || attendanceResult.loading
      ? 'Memeriksa data presensi...'
    : enrollmentError
      ? 'Data pendaftaran tidak dapat dimuat'
    : !isEnrolledPraktikan
      ? 'Tidak terdaftar di sesi ini'
      : alreadyCheckedIn
        ? activeAttendance?.status === 'izin' ? 'Izin Tercatat' : 'Sudah Presensi'
        : session?.status === 'dibuka'
          ? 'Presensi Sekarang'
          : session?.status === 'terjadwal'
            ? 'Presensi Belum Tersedia'
            : 'Sesi Telah Ditutup';
  const actionDisabled = !session
    || activeRole === null
    || submittingAction
    || (isAssistant && session.status === 'ditutup')
    || (!isAssistant && (
      !activePraktikanId
      || enrollmentLoading
      || Boolean(enrollmentError)
      || attendanceResult.loading
      || !isEnrolledPraktikan
      || alreadyCheckedIn
      || session.status !== 'dibuka'
    ));
  const actionHint = activeRole === null
    ? 'Sesi autentikasi belum tersedia. Silakan masuk kembali.'
    : isAssistant
      ? session?.status === 'terjadwal'
        ? 'Buka sesi saat praktikum dimulai.'
        : session?.status === 'dibuka'
          ? 'Tutup sesi setelah praktikum selesai.'
          : 'Sesi ini sudah ditutup.'
      : !activePraktikanId
        ? 'Data enrollment akun belum tersedia untuk dihubungkan ke sesi.'
      : enrollmentLoading
        ? 'Memeriksa pendaftaran akun ke kelas sesi ini...'
      : enrollmentError
        ? enrollmentError
      : attendanceResult.loading
        ? 'Memeriksa apakah presensi sudah tercatat...'
      : !isEnrolledPraktikan
        ? 'Akun ini tidak terdaftar pada kelas praktikum tersebut.'
      : alreadyCheckedIn
          ? activeAttendance?.status === 'izin'
            ? 'Status izinnya sudah tercatat untuk sesi ini.'
            : ''
          : session?.status === 'terjadwal'
            ? 'Presensi tersedia setelah asisten membuka sesi.'
            : session?.status === 'ditutup'
              ? 'Presensi tidak tersedia karena sesi sudah ditutup.'
              : 'Pastikan detail sesi benar sebelum melakukan presensi.';
  const actionConfirmation = pendingAction === 'open'
    ? {
      title: 'Buka sesi praktikum?',
      message: 'Praktikan dapat melakukan presensi setelah sesi dibuka.',
      confirmLabel: 'Buka Sesi',
      destructive: false,
    }
    : pendingAction === 'close'
      ? {
        title: 'Tutup sesi praktikum?',
        message: 'Praktikan tidak dapat melakukan presensi setelah sesi ditutup.',
        confirmLabel: 'Tutup Sesi',
        destructive: true,
      }
      : pendingAction === 'checkin'
        ? {
          title: 'Konfirmasi presensi',
          message: `Presensi sebagai ${currentUser?.name ?? 'praktikan'}? Waktu kehadiran akan dicatat.`,
          confirmLabel: 'Konfirmasi',
          destructive: false,
        }
        : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {sessionResult.loading ? (
        <View style={styles.missing}>
          <View style={styles.missingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.missingTitle}>Memuat sesi...</Text>
            <Text style={styles.missingCopy}>Detail sesi diambil langsung dari Firestore.</Text>
          </View>
        </View>
      ) : !session ? (
        <View style={styles.missing}>
          <View style={styles.missingCard}>
            <Ionicons name="calendar-outline" size={38} color={colors.primary} />
            <Text style={styles.missingTitle}>
              {sessionResult.error ? 'Sesi tidak dapat dimuat' : 'Sesi tidak ditemukan'}
            </Text>
            <Text style={styles.missingCopy}>
              {sessionResult.error ?? 'Sesi ini mungkin sudah tidak tersedia. Kembali ke jadwal untuk memilih sesi lain.'}
            </Text>
            <Pressable onPress={handleBack} style={styles.primaryButton} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>Kembali ke jadwal</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            ref={detailScrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={styles.statusCard}
              onLayout={({ nativeEvent: { layout } }) => {
                setStatusCardSize({ width: layout.width, height: layout.height });
              }}
            >
              {statusCardSize.width > 2 && statusCardSize.height > 2 ? (
                <Svg
                  width={statusCardSize.width - 2}
                  height={statusCardSize.height - 2}
                  viewBox={`0 0 ${statusCardSize.width - 2} ${statusCardSize.height - 2}`}
                  style={styles.statusGradient}
                  pointerEvents="none"
                >
                  <Defs>
                    <LinearGradient id="sessionStatusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#FFF9FB" />
                      <Stop offset="100%" stopColor="#F8D3E0" />
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x={0}
                    y={0}
                    width={statusCardSize.width - 2}
                    height={statusCardSize.height - 2}
                    fill="url(#sessionStatusGradient)"
                  />
                </Svg>
              ) : null}
              <Ionicons
                name={session.status === 'dibuka' ? 'checkmark-circle' : session.status === 'ditutup' ? 'lock-closed' : 'time'}
                size={25}
                color={colors.primaryDark}
              />
              <View style={styles.statusCopy}>
                <Text style={styles.statusLabel}>Status Sesi</Text>
                <Text style={styles.statusTitle}>
                  {session.status === 'terjadwal'
                    ? 'Terjadwal (Mendatang)'
                    : session.status === 'dibuka'
                      ? 'Sedang Berlangsung'
                      : 'Sesi Ditutup'}
                </Text>
              </View>
              <StatusBadge status={session.status} />
            </View>

            <View style={styles.sessionCard}>
              <View style={styles.sessionHeading}>
                <View style={styles.sessionCopy}>
                  <Text style={styles.sectionEyebrow}>PRAKTIKUM</Text>
                  <Text style={styles.sessionTitle}>{session.practicumName}</Text>
                  <Text style={styles.sessionSubtitle}>
                    {sessionCourse ? `Semester ${sessionCourse.semester} · ` : ''}
                    {getLabLabel(session)} · Pertemuan {getMeetingNumber(session)}
                  </Text>
                </View>
                <View style={styles.sessionIcon}>
                  <Ionicons name="laptop" size={27} color={colors.primary} />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoGrid}>
                <InfoRow icon="calendar" label="TANGGAL" value={formatDateLong(session.startsAt)} />
                <InfoRow
                  icon="time"
                  label="WAKTU"
                  value={`${formatTime(session.startsAt)}–${formatTime(session.endsAt)} WIB`}
                />
                <InfoRow
                  icon="business"
                  label="LOKASI LABORATORIUM"
                  value={getLabLabel(session)}
                />
                <InfoRow
                  icon="people"
                  label="KELAS"
                  value={`Kelas ${session.className} · Pertemuan ${getMeetingNumber(session)}`}
                />
              </View>
            </View>

            {!isAssistant && activeAttendance ? (
              <View style={styles.locationDetailsWrap}>
                <AttendanceLocationDetails attendance={activeAttendance} />
              </View>
            ) : null}

            {isAssistant ? (
              <>
                <View style={styles.attendanceCard}>
                  <View style={styles.attendanceHeading}>
                    <View>
                      <Text style={styles.attendanceTitle}>Statistik Presensi</Text>
                      <Text style={styles.attendanceSubtitle}>
                        {enrollmentTotalKnown
                          ? `${enrolledPraktikans.length} mahasiswa terdaftar`
                          : `${presentPraktikans.length + excusedPraktikans.length} presensi tercatat`}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => detailScrollRef.current?.scrollTo({
                        y: rosterOffset.current,
                        animated: true,
                      })}
                      style={styles.viewListButton}
                    >
                      <Text style={styles.viewListText}>Lihat Daftar</Text>
                      <Ionicons name="chevron-down" size={16} color={colors.primary} />
                    </Pressable>
                  </View>

                  <View style={styles.statsGrid}>
                    <AttendanceStat label="Hadir" value={presentPraktikans.length} tone="success" />
                    <AttendanceStat label="Izin" value={excusedPraktikans.length} tone="info" />
                    <AttendanceStat label="Sakit" value={sickPraktikans.length} tone="info" />
                    <AttendanceStat
                      label={session.status === 'ditutup' ? 'Alpha' : 'Belum Presensi'}
                      value={notRecordedPraktikans.length}
                      tone="warning"
                    />
                    <AttendanceStat label="Total" value={enrollmentTotalKnown ? enrolledPraktikans.length : rosterEntries.length} />
                  </View>

                  {enrollmentTotalKnown ? (
                    <>
                      <View style={styles.percentageRow}>
                        <Text style={styles.percentageLabel}>Persentase Hadir</Text>
                        <Text style={styles.percentageValue}>{presentPercentage.toFixed(1)}%</Text>
                      </View>
                      <View style={styles.percentageRow}>
                        <Text style={styles.percentageLabel}>Presensi Tercatat (Hadir + Izin + Sakit)</Text>
                        <Text style={styles.percentageValue}>{recordedPercentage.toFixed(1)}%</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${recordedPercentage}%` }]} />
                      </View>
                    </>
                  ) : (
                    <Text style={styles.actionHint}>
                      Persentase kehadiran belum dapat dihitung karena daftar enrollment kelas
                      belum dapat dibaca.
                    </Text>
                  )}
                </View>

                <View style={styles.shareBlock}>
                  {session.status === 'dibuka' ? (
                    <>
                      <Text style={styles.shareLabel}>Link presensi praktikan</Text>
                      <Link
                        href={attendanceLink as ExternalPathString}
                        style={styles.shareLink}
                        accessibilityLabel={`Buka presensi ${session.practicumName}`}
                      >
                        {attendanceLink}
                      </Link>
                      <Pressable
                        onPress={() => void shareAttendanceLink()}
                        accessibilityRole="button"
                        accessibilityLabel={`Bagikan link presensi ${session.practicumName}`}
                        style={({ pressed }) => [styles.shareButton, pressed && styles.buttonPressed]}
                      >
                        <Ionicons name="share-social-outline" size={18} color={colors.textOnPrimary} />
                        <Text style={styles.shareButtonText}>Bagikan Link</Text>
                      </Pressable>
                      <View style={styles.qrPanel}>
                        <Text style={styles.shareLabel}>QR LINK PRESENSI</Text>
                        <Text style={styles.qrSessionInfo}>
                          {session.practicumName} · Kelas {session.className}
                        </Text>
                        {attendanceLink ? (
                          <View style={styles.qrContainer}>
                            <QrRenderBoundary
                              key={session.id}
                              fallback={(
                                <Text accessibilityLiveRegion="polite" style={styles.qrError}>
                                  QR tidak dapat ditampilkan. Bagikan tautan HTTPS di atas.
                                </Text>
                              )}
                            >
                              <QRCode value={attendanceLink} size={200} />
                            </QrRenderBoundary>
                            <Text style={styles.qrCaption}>
                              Pindai untuk membuka halaman presensi sesi ini.
                            </Text>
                          </View>
                        ) : (
                          <Text accessibilityLiveRegion="polite" style={styles.qrError}>
                            Link HTTPS tidak dapat dibuat. Periksa konfigurasi Firebase Hosting.
                          </Text>
                        )}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.inactiveShareText}>
                      {session.status === 'terjadwal'
                        ? 'Link dan QR presensi tersedia setelah sesi dibuka.'
                        : 'Sesi sudah ditutup. QR tidak dapat diterbitkan atau digunakan.'}
                    </Text>
                  )}
                </View>

                <View
                  style={styles.rosterSection}
                  onLayout={(event) => {
                    rosterOffset.current = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.rosterHeading}>
                    <Text style={styles.rosterTitle}>Daftar Praktikan</Text>
                    <Text style={styles.rosterCount}>
                      {enrollmentLoading ? 'Memuat...' : `${rosterEntries.length} mahasiswa`}
                    </Text>
                  </View>
                  {enrollmentError ? (
                    <Text style={styles.actionHint}>
                      Daftar praktikan lengkap belum dapat dimuat. Presensi yang sudah tercatat
                      tetap ditampilkan di bawah.
                    </Text>
                  ) : null}
                  {rosterEntries.map((praktikan) => {
                    const attendance = attendanceByPraktikan.get(praktikan.praktikanId);
                    const isExcused = attendance?.status === 'izin';
                    const isCancelled = attendance?.status === 'dibatalkan';
                    const hasAttended = attendance?.status === 'hadir';
                    const statusLabel = isCancelled
                      ? 'Presensi dibatalkan'
                      : isExcused
                        ? attendance.excuseReason === 'sakit' ? 'Sakit' : 'Izin lainnya'
                        : hasAttended
                          ? `Hadir · ${formatTime(attendance.attendedAt)} WIB`
                          : session.status === 'ditutup' ? 'Alpha' : 'Belum melakukan presensi';
                    const methodLabel = attendance?.attendanceMethod
                      ? ` · ${attendance.attendanceMethod === 'qr' ? 'QR Asprak' : 'Lokasi'}`
                      : '';

                    return (
                      <Pressable
                        key={praktikan.praktikanId}
                        accessibilityRole={attendance ? 'button' : undefined}
                        accessibilityLabel={attendance
                          ? `Lihat detail presensi ${praktikan.praktikanName}`
                          : undefined}
                        disabled={!attendance}
                        onPress={() => {
                          if (attendance) setSelectedAttendance(attendance);
                        }}
                        style={({ pressed }) => [
                          styles.personRow,
                          pressed && attendance && styles.mainActionPressed,
                        ]}
                      >
                        <View style={styles.personAvatar}>
                          <Text style={styles.personInitial}>
                            {praktikan.praktikanName.charAt(0)}
                          </Text>
                        </View>
                        <View style={styles.personCopy}>
                          <Text style={styles.personName}>{praktikan.praktikanName}</Text>
                          <Text style={styles.personDetail}>
                            {praktikan.semester ? `Semester ${praktikan.semester} · ` : ''}
                            {statusLabel}{methodLabel}
                          </Text>
                          {typeof attendance?.distanceMeters === 'number' ? (
                            <Text style={styles.personDetail}>
                              Jarak {Math.round(attendance.distanceMeters)} m
                              {typeof attendance.accuracyMeters === 'number'
                                ? ` · Akurasi ${Math.round(attendance.accuracyMeters)} m`
                                : ''}
                            </Text>
                          ) : null}
                          {attendance ? (
                            <Text style={styles.personDetail}>Ketuk untuk detail dan tindakan</Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name={attendance
                            ? 'chevron-forward'
                            : isExcused
                              ? 'document-text-outline'
                              : hasAttended
                                ? 'checkmark-circle'
                                : 'time-outline'}
                          size={20}
                          color={attendance
                            ? colors.primary
                            : isExcused
                              ? colors.primary
                              : hasAttended
                                ? colors.success
                                : colors.warning}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={styles.contactCard}>
              <SupportContactCard title="BANTUAN PRAKTIKUM" />
            </View>
          </ScrollView>

          <View style={styles.actionDock}>
            {actionFeedback ? (
              <View
                style={[
                  styles.actionFeedback,
                  actionFeedback.tone === 'error' && styles.actionFeedbackError,
                ]}
                accessibilityLiveRegion="polite"
              >
                <Ionicons
                  name={actionFeedback.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={actionFeedback.tone === 'success' ? colors.success : colors.danger}
                />
                <View style={styles.actionFeedbackCopy}>
                  <Text style={styles.actionFeedbackTitle}>{actionFeedback.title}</Text>
                  {actionFeedback.message ? (
                    <Text style={styles.actionFeedbackMessage}>{actionFeedback.message}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => setActionFeedback(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Tutup pesan"
                  hitSlop={8}
                  style={styles.actionFeedbackDismiss}
                >
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}
            {!isAssistant && activeAttendance?.status === 'hadir' ? (
              <View style={styles.attendanceStamp}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.attendanceStampText}>
                  Presensi tercatat pukul {formatTime(activeAttendance.attendedAt)} WIB
                </Text>
              </View>
            ) : null}
            {actionHint ? <Text style={styles.actionHint}>{actionHint}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={actionDisabled}
              onPress={isAssistant ? handleAssistantAction : handlePractikanAction}
              style={({ pressed }) => [
                styles.mainAction,
                actionDisabled && styles.mainActionDisabled,
                pressed && !actionDisabled && styles.mainActionPressed,
              ]}
            >
              <Ionicons
                name={isAssistant
                  ? session.status === 'ditutup' ? 'lock-closed' : 'power'
                  : alreadyCheckedIn ? 'checkmark-circle' : 'checkmark-done-circle'}
                size={23}
                color={actionDisabled ? colors.textMuted : colors.textOnPrimary}
              />
              <Text style={[styles.mainActionText, actionDisabled && styles.mainActionTextDisabled]}>
                {buttonLabel}
              </Text>
            </Pressable>
            {!isAssistant
              && activeRole === 'praktikan'
              && session.status === 'dibuka'
              && isEnrolledPraktikan
              && !alreadyCheckedIn ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scan QR Asprak"
                onPress={() => router.push({
                  pathname: '/praktikan/qr-scan',
                  params: { sessionId: session.id },
                })}
                style={({ pressed }) => [styles.qrScanButton, pressed && styles.mainActionPressed]}
              >
                <Ionicons name="qr-code-outline" size={19} color={colors.primaryDark} />
                <Text style={styles.qrScanButtonText}>Scan QR Asprak</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
      <ConfirmationModal
        visible={pendingAction !== null}
        title={actionConfirmation?.title ?? ''}
        message={actionConfirmation?.message ?? ''}
        confirmLabel={actionConfirmation?.confirmLabel ?? 'Konfirmasi'}
        destructive={actionConfirmation?.destructive ?? false}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />
      <ConfirmationModal
        visible={cancelRecord !== null}
        title="Batalkan presensi praktikan?"
        message={
          cancelRecord
            ? `Presensi ${cancelRecord.praktikanName} akan dibatalkan dan tidak lagi dihitung hadir.${cancelReason ? ` Alasan: ${cancelReason}` : ''}`
            : 'Presensi akan dibatalkan.'
        }
        confirmLabel="Batalkan Presensi"
        destructive
        onCancel={() => {
          setCancelRecord(null);
          setCancelReason('');
        }}
        onConfirm={() => void handleConfirmCancel()}
      />
      <AttendanceDetailModal
        record={selectedAttendance}
        onClose={() => setSelectedAttendance(null)}
        onCancel={canManageAttendance ? handleRequestCancel : undefined}
      />
      <BottomNav />
    </SafeAreaView>
  );
}

function AttendanceStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  return (
    <View
      style={[
        styles.statCard,
        tone === 'success' && styles.statSuccess,
        tone === 'warning' && styles.statWarning,
        tone === 'info' && styles.statInfo,
      ]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  statusCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: '#FFF9FB',
    ...shadows.card,
  },
  statusGradient: {
    position: 'absolute',
    top: 1,
    left: 1,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: colors.primaryDeep,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  statusTitle: {
    marginTop: 2,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  sessionCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  locationDetailsWrap: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  sessionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionEyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  sessionTitle: {
    marginTop: spacing.xs,
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 19,
    lineHeight: 25,
  },
  sessionSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  sessionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  divider: {
    height: 1,
    marginVertical: spacing.lg,
    backgroundColor: colors.border,
  },
  infoGrid: {
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  infoValue: {
    marginTop: 2,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  contactCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  attendanceCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  attendanceHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  attendanceTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  attendanceSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  viewListButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
  },
  viewListText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  statsGrid: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  statSuccess: {
    backgroundColor: colors.successBg,
  },
  statWarning: {
    backgroundColor: colors.warningBg,
  },
  statInfo: {
    backgroundColor: colors.primarySoft,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textAlign: 'center',
  },
  statValue: {
    marginTop: 2,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  percentageRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  percentageLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  percentageValue: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  progressTrack: {
    height: 7,
    marginTop: spacing.sm,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  shareBlock: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundAlt,
  },
  shareLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  shareLink: {
    marginTop: spacing.xs,
    color: colors.primaryDark,
    fontFamily: fonts.regular,
    fontSize: 11,
    textDecorationLine: 'underline',
    lineHeight: 16,
  },
  shareButton: {
    minHeight: 44,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
  },
  shareButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  qrPanel: {
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  qrSessionInfo: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  qrContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  qrCaption: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  qrError: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.55,
  },
  inactiveShareText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  rosterSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  rosterHeading: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rosterTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  rosterCount: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  personRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  personAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
  },
  personInitial: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  personDetail: {
    marginTop: 2,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  excuseButton: {
    minWidth: 48,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  excuseButtonText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  actionDock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  actionHint: {
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  actionFeedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
  },
  actionFeedbackError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  actionFeedbackCopy: {
    flex: 1,
    gap: 1,
  },
  actionFeedbackTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  actionFeedbackMessage: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  actionFeedbackDismiss: {
    padding: 2,
  },
  attendanceStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
  },
  attendanceStampText: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  mainAction: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDark,
  },
  mainActionPressed: {
    opacity: 0.86,
  },
  mainActionDisabled: {
    backgroundColor: colors.neutralBg,
    borderColor: colors.neutralBorder,
    borderWidth: 1,
  },
  mainActionText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'center',
  },
  mainActionTextDisabled: {
    color: colors.neutral,
  },
  qrScanButton: {
    minHeight: 46,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySofter,
  },
  qrScanButtonText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  missing: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  missingCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  missingTitle: {
    marginTop: spacing.md,
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
    textAlign: 'center',
  },
  missingCopy: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: spacing.lg,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
