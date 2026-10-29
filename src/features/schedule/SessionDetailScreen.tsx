import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
import BottomNav from '../../components/BottomNav';
import ConfirmationModal from '../../components/ConfirmationModal';
import { SupportContactCard } from '../../components/DashboardWidgets';
import StatusBadge from '../../components/StatusBadge';
import { getPraktikanIdsForSession } from '../../data/sessionEnrollments';
import { praktikans } from '../../data/praktikans';
import { useAttendance } from '../../state/AttendanceContext';
import { formatDateLong, formatTime } from '../../utils/format';
import { getLabLabel, getMeetingNumber } from '../../utils/session';
import { getCourseById, getPraktikanById } from '../../utils/academic';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { Attendance, ExcuseReason, Praktikan } from '../../types';

type PendingSessionAction = 'open' | 'close' | 'checkin';

type ActionFeedback = {
  tone: 'success' | 'error';
  title: string;
  message: string;
};

function createAttendanceLink(sessionId: string): string {
  const encodedId = encodeURIComponent(sessionId);
  const route = `/schedule/${encodedId}?role=praktikan`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return `presensipraktikum:///schedule/${encodedId}?role=praktikan`;
    }
    return new URL(route, origin).toString();
  }

  return Linking.createURL(`/schedule/${encodedId}`, {
    scheme: 'presensipraktikum',
    queryParams: { role: 'praktikan' },
  });
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
  const params = useLocalSearchParams<{ id: string | string[]; role?: string | string[] }>();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    sessions,
    attendances,
    activeRole,
    activePraktikanId,
    setActiveRole,
    openSession,
    closeSession,
    checkIn,
    markExcused,
  } = useAttendance();
  const session = sessions.find((item) => item.id === sessionId);
  const sessionCourse = session ? getCourseById(session.courseId) : undefined;
  const linkedRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const activePraktikan = getPraktikanById(activePraktikanId);
  const isAssistant = activeRole === 'assistant';
  const activeAttendance = attendances.find(
    (attendance) =>
      attendance.sessionId === sessionId && attendance.praktikanId === activePraktikanId,
  );
  const detailScrollRef = useRef<ScrollViewInstance | null>(null);
  const rosterOffset = useRef(0);
  const [statusCardSize, setStatusCardSize] = useState({ width: 0, height: 0 });
  const enrolledPraktikans = session
    ? getPraktikanIdsForSession(session.id)
      .map((praktikanId) => praktikans.find((praktikan) => praktikan.id === praktikanId))
      .filter((praktikan): praktikan is Praktikan => praktikan !== undefined)
    : [];
  const enrolledIds = new Set(enrolledPraktikans.map((praktikan) => praktikan.id));
  const attendanceByPraktikan = new Map<string, Attendance>();
  attendances.forEach((attendance) => {
    if (attendance.sessionId === sessionId && enrolledIds.has(attendance.praktikanId)) {
      attendanceByPraktikan.set(attendance.praktikanId, attendance);
    }
  });
  const presentPraktikans = enrolledPraktikans.filter((praktikan) => {
    const attendance = attendanceByPraktikan.get(praktikan.id);
    return attendance !== undefined && attendance.status !== 'izin';
  });
  const sickPraktikans = enrolledPraktikans.filter((praktikan) => {
    const attendance = attendanceByPraktikan.get(praktikan.id);
    return attendance?.status === 'izin' && attendance.excuseReason === 'sakit';
  });
  const excusedPraktikans = enrolledPraktikans.filter((praktikan) => {
    const attendance = attendanceByPraktikan.get(praktikan.id);
    return attendance?.status === 'izin' && attendance.excuseReason !== 'sakit';
  });
  const notRecordedPraktikans = enrolledPraktikans.filter(
    (praktikan) => !attendanceByPraktikan.has(praktikan.id),
  );
  const presentPercentage = enrolledPraktikans.length === 0
    ? 0
    : (presentPraktikans.length / enrolledPraktikans.length) * 100;
  const recordedPercentage = enrolledPraktikans.length === 0
    ? 0
    : ((presentPraktikans.length + excusedPraktikans.length) / enrolledPraktikans.length) * 100;
  const alreadyCheckedIn = activeAttendance !== undefined;
  const [pendingAction, setPendingAction] = useState<PendingSessionAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

  useEffect(() => {
    if (linkedRole === 'praktikan' && activeRole !== 'praktikan') {
      setActiveRole('praktikan');
    }
  }, [activeRole, linkedRole, setActiveRole]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/schedule');
  };

  const showActionResult = (
    result: ReturnType<typeof openSession>,
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
    if (!session) return;
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
      || !activePraktikan
      || alreadyCheckedIn
    ) return;
    setActionFeedback(null);
    setPendingAction('checkin');
  };

  const handleConfirmAction = () => {
    const action = pendingAction;
    if (!session || !action) return;
    setPendingAction(null);

    if (action === 'open') {
      showActionResult(
        openSession(session.id),
        'Sesi dibuka',
        'Status sesi sudah diperbarui.',
      );
      return;
    }
    if (action === 'close') {
      showActionResult(
        closeSession(session.id),
        'Sesi ditutup',
        'Sesi praktikum berhasil ditutup.',
      );
      return;
    }
    if (activePraktikanId) {
      showActionResult(
        checkIn(session.id, activePraktikanId),
        'Presensi berhasil',
        'Kehadiranmu berhasil dicatat.',
      );
    }
  };

  const handleMarkExcused = (praktikan: Praktikan) => {
    if (!session) return;
    const confirmExcused = (reason: ExcuseReason) => {
      const result = markExcused(session.id, praktikan.id, reason);
      Alert.alert(
        result.ok ? 'Status izin diperbarui' : 'Status izin tidak berhasil',
        result.ok
          ? `${praktikan.name} dicatat ${reason === 'sakit' ? 'sakit' : 'izin lainnya'}.`
          : result.reason ?? 'Silakan coba lagi.',
      );
    };

    Alert.alert(
      'Konfirmasi status izin',
      `Tetapkan status izin untuk ${praktikan.name}? Pilih alasan untuk menyimpan perubahan.`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Sakit', onPress: () => confirmExcused('sakit') },
        { text: 'Izin lainnya', onPress: () => confirmExcused('izin-lainnya') },
      ],
    );
  };

  const handleManualAttendance = (praktikan: Praktikan) => {
    if (!session || session.status !== 'dibuka' || attendanceByPraktikan.has(praktikan.id)) return;

    const saveExcusedStatus = (reason: ExcuseReason) => {
      const result = markExcused(session.id, praktikan.id, reason);
      Alert.alert(
        result.ok ? 'Status presensi dicatat' : 'Status presensi tidak berhasil',
        result.ok
          ? `${praktikan.name} dicatat ${reason === 'sakit' ? 'sakit' : 'izin lainnya'}.`
          : result.reason ?? 'Silakan coba lagi.',
      );
    };

    Alert.alert(
      'Presensi Manual',
      `Pilih keterangan presensi untuk ${praktikan.name}.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hadir',
          onPress: () => showActionResult(
            checkIn(session.id, praktikan.id),
            'Presensi berhasil dicatat',
            `${praktikan.name} dicatat hadir.`,
          ),
        },
        {
          text: 'Izin / Sakit',
          onPress: () => Alert.alert(
            'Pilih Keterangan',
            `Pilih keterangan untuk ${praktikan.name}.`,
            [
              { text: 'Batal', style: 'cancel' },
              { text: 'Sakit', onPress: () => saveExcusedStatus('sakit') },
              { text: 'Izin lainnya', onPress: () => saveExcusedStatus('izin-lainnya') },
            ],
          ),
        },
      ],
    );
  };

  const shareAttendanceLink = async () => {
    if (!session) return;
    const link = createAttendanceLink(session.id);

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined') {
          Alert.alert('Link tidak dapat dibagikan', 'Fitur berbagi tidak tersedia di browser ini.');
          return;
        }
        if (typeof navigator.share === 'function') {
          await navigator.share({ title: `Presensi ${session.practicumName}`, text: link });
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
    ? session?.status === 'terjadwal'
      ? 'Buka Sesi Praktikum'
      : session?.status === 'dibuka'
        ? 'Tutup Sesi Presensi'
        : 'Sesi Telah Ditutup'
    : activeRole === null
      ? 'Pilih Peran'
    : !activePraktikanId
      ? 'Pilih Identitas Praktikan'
      : alreadyCheckedIn
        ? activeAttendance?.status === 'izin' ? 'Izin Tercatat' : 'Sudah Presensi'
        : session?.status === 'dibuka'
          ? 'Presensi Sekarang'
          : session?.status === 'terjadwal'
            ? 'Presensi Belum Tersedia'
            : 'Sesi Telah Ditutup';
  const actionDisabled = !session
    || activeRole === null
    || (isAssistant && session.status === 'ditutup')
    || (!isAssistant && (!activePraktikanId || alreadyCheckedIn || session.status !== 'dibuka'));
  const actionHint = activeRole === null
    ? 'Pilih peran terlebih dahulu untuk melihat aksi sesi.'
    : isAssistant
      ? session?.status === 'terjadwal'
        ? 'Buka sesi saat praktikum dimulai.'
        : session?.status === 'dibuka'
          ? 'Tutup sesi setelah praktikum selesai.'
          : 'Sesi ini sudah ditutup.'
      : !activePraktikanId
        ? 'Pilih identitas praktikan dari menu Profil terlebih dahulu.'
        : alreadyCheckedIn
          ? activeAttendance?.status === 'izin'
            ? 'Status izinnya sudah tercatat untuk sesi ini.'
            : 'Presensimu untuk sesi ini sudah tercatat.'
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
          message: `Presensi sebagai ${activePraktikan?.name ?? 'praktikan'}? Waktu kehadiran akan dicatat.`,
          confirmLabel: 'Konfirmasi',
          destructive: false,
        }
        : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {!session ? (
        <View style={styles.missing}>
          <View style={styles.missingCard}>
            <Ionicons name="calendar-outline" size={38} color={colors.primary} />
            <Text style={styles.missingTitle}>Sesi tidak ditemukan</Text>
            <Text style={styles.missingCopy}>Sesi ini mungkin sudah tidak tersedia. Kembali ke jadwal untuk memilih sesi lain.</Text>
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

            {isAssistant ? (
              <>
                <View style={styles.attendanceCard}>
                  <View style={styles.attendanceHeading}>
                    <View>
                      <Text style={styles.attendanceTitle}>Statistik Presensi</Text>
                      <Text style={styles.attendanceSubtitle}>
                        {enrolledPraktikans.length} mahasiswa terdaftar
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
                    <AttendanceStat label="Total" value={enrolledPraktikans.length} />
                  </View>

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
                </View>

                {session.status === 'dibuka' ? (
                  <View style={styles.shareBlock}>
                    <Text style={styles.shareLabel}>Link presensi aktif</Text>
                    <Text style={styles.shareLink} selectable>{createAttendanceLink(session.id)}</Text>
                    <Pressable
                      onPress={() => void shareAttendanceLink()}
                      accessibilityRole="button"
                      accessibilityLabel={`Bagikan link presensi ${session.practicumName}`}
                      style={({ pressed }) => [styles.shareButton, pressed && styles.buttonPressed]}
                    >
                      <Ionicons name="share-social-outline" size={18} color={colors.textOnPrimary} />
                      <Text style={styles.shareButtonText}>Bagikan Link</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View
                  style={styles.rosterSection}
                  onLayout={(event) => {
                    rosterOffset.current = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.rosterHeading}>
                    <Text style={styles.rosterTitle}>Daftar Praktikan</Text>
                    <Text style={styles.rosterCount}>{enrolledPraktikans.length} mahasiswa</Text>
                  </View>
                  {enrolledPraktikans.map((praktikan) => {
                    const attendance = attendanceByPraktikan.get(praktikan.id);
                    const isExcused = attendance?.status === 'izin';
                    const hasAttended = attendance !== undefined && !isExcused;
                    const statusLabel = isExcused
                      ? attendance.excuseReason === 'sakit' ? 'Sakit' : 'Izin lainnya'
                      : hasAttended
                        ? `Hadir · ${formatTime(attendance.attendedAt)} WIB`
                        : session.status === 'ditutup' ? 'Alpha' : 'Belum melakukan presensi';

                    return (
                      <View key={praktikan.id} style={styles.personRow}>
                        <View style={styles.personAvatar}>
                          <Text style={styles.personInitial}>{praktikan.name.charAt(0)}</Text>
                        </View>
                        <View style={styles.personCopy}>
                          <Text style={styles.personName}>{praktikan.name}</Text>
                          <Text style={styles.personDetail}>
                            Semester {praktikan.semester} · {statusLabel}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExcused ? 'document-text-outline' : hasAttended ? 'checkmark-circle' : 'time-outline'}
                          size={20}
                          color={isExcused ? colors.primary : hasAttended ? colors.success : colors.warning}
                        />
                        {session.status === 'dibuka' && (isExcused ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Ubah alasan izin untuk ${praktikan.name}`}
                            onPress={() => handleMarkExcused(praktikan)}
                            style={styles.excuseButton}
                          >
                            <Text style={styles.excuseButtonText}>Ubah</Text>
                          </Pressable>
                        ) : !hasAttended ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Catat presensi manual untuk ${praktikan.name}`}
                            onPress={() => handleManualAttendance(praktikan)}
                            style={styles.excuseButton}
                          >
                            <Text style={styles.excuseButtonText}>Catat</Text>
                          </Pressable>
                        ) : null)}
                      </View>
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
                  <Text style={styles.actionFeedbackMessage}>{actionFeedback.message}</Text>
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
            {!isAssistant && activeAttendance && activeAttendance.status !== 'izin' ? (
              <View style={styles.attendanceStamp}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.attendanceStampText}>
                  Presensi tercatat pukul {formatTime(activeAttendance.attendedAt)} WIB
                </Text>
              </View>
            ) : null}
            <Text style={styles.actionHint}>{actionHint}</Text>
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
        onConfirm={handleConfirmAction}
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
