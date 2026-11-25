import { StyleSheet, Text, View } from 'react-native';
import type { Attendance } from '../types';
import { colors, fonts, radius, spacing } from '../theme';
import { formatDateTime } from '../utils/format';
import { isAttendanceLocationVerified } from '../utils/attendanceLocation';

function formatMeters(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value)} meter`
    : 'Tidak tersedia';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function AttendanceLocationDetails({
  attendance,
}: {
  attendance: Attendance;
}) {
  const verified = isAttendanceLocationVerified(attendance);
  const statusLabel = attendance.status === 'dibatalkan'
    ? 'Presensi dibatalkan; metadata awal tetap disimpan.'
    : verified
      ? 'Valid — dikonfirmasi backend.'
      : attendance.status === 'izin'
        ? 'Tidak berlaku untuk presensi izin.'
        : 'Tidak dapat diverifikasi; metadata lokasi tidak lengkap atau tidak konsisten.';
  const laboratory = attendance.laboratoryName?.trim()
    || attendance.laboratoryId
    || 'Tidak tersedia';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Detail Lokasi Presensi</Text>
      <DetailRow label="Laboratorium" value={laboratory} />
      <DetailRow
        label="Metode presensi"
        value={
          attendance.attendanceMethod === 'qr'
            ? 'QR'
            : attendance.attendanceMethod === 'location'
              ? 'Lokasi'
              : 'Tidak tersedia'
        }
      />
      <DetailRow label="Status lokasi" value={statusLabel} />
      <DetailRow label="Jarak dari laboratorium" value={formatMeters(attendance.distanceMeters)} />
      <DetailRow label="Radius maksimum" value={formatMeters(attendance.radiusMeters)} />
      <DetailRow label="Akurasi GPS" value={formatMeters(attendance.accuracyMeters)} />
      <DetailRow
        label="Latitude"
        value={typeof attendance.latitude === 'number' && Number.isFinite(attendance.latitude)
          ? attendance.latitude.toFixed(6)
          : 'Tidak tersedia'}
      />
      <DetailRow
        label="Longitude"
        value={typeof attendance.longitude === 'number' && Number.isFinite(attendance.longitude)
          ? attendance.longitude.toFixed(6)
          : 'Tidak tersedia'}
      />
      <DetailRow
        label="Waktu presensi"
        value={attendance.attendedAt ? formatDateTime(attendance.attendedAt) : 'Tidak tercatat'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    marginBottom: spacing.xs,
    color: colors.primaryDeep,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  value: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textAlign: 'right',
  },
});
