import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AttendanceRecord } from '../services/attendanceService';
import { colors, fonts, radius, shadows, spacing } from '../theme';
import { formatDateTime } from '../utils/format';
import AttendanceLocationDetails from './AttendanceLocationDetails';

type Props = {
  record: AttendanceRecord | null;
  onClose: () => void;
  onCancel?: (record: AttendanceRecord, reason: string) => void;
};

export default function AttendanceDetailModal({ record, onClose, onCancel }: Props) {
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onClose();
  };

  const status = record?.status === 'dibatalkan'
    ? 'Dibatalkan'
    : record?.status === 'izin'
      ? 'Izin'
      : 'Hadir';

  return (
    <Modal
      visible={record !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        {record ? (
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>REKAP PRESENSI</Text>
                <Text style={styles.title}>Detail Kehadiran</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup detail kehadiran"
                hitSlop={8}
                onPress={close}
              >
                <Ionicons name="close-circle" size={27} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.identity}>
                <Text style={styles.name}>{record.praktikanName}</Text>
                <Text style={styles.meta}>
                  {record.attendedAt ? formatDateTime(record.attendedAt) : 'Waktu presensi tidak tercatat'}
                </Text>
                <Text style={styles.meta}>Status presensi: {status}</Text>
              </View>

              <AttendanceLocationDetails attendance={record} />

              {record.status === 'dibatalkan' ? (
                <View style={styles.audit}>
                  <Text style={styles.auditTitle}>Audit pembatalan</Text>
                  <Text style={styles.meta}>
                    Waktu: {record.cancelledAt ? formatDateTime(record.cancelledAt) : 'Tidak tercatat'}
                  </Text>
                  <Text style={styles.meta}>
                    Dibatalkan oleh: {record.cancelledBy ?? 'Tidak tercatat'}
                  </Text>
                  {record.cancelReason ? (
                    <Text style={styles.meta}>Alasan: {record.cancelReason}</Text>
                  ) : null}
                </View>
              ) : null}

              {record.status === 'hadir' && onCancel ? (
                <View style={styles.cancelSection}>
                  <Text style={styles.cancelLabel}>Alasan pembatalan (opsional)</Text>
                  <TextInput
                    accessibilityLabel="Alasan pembatalan presensi"
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Contoh: metadata lokasi tidak sesuai"
                    placeholderTextColor={colors.textMuted}
                    maxLength={300}
                    multiline
                    style={styles.reasonInput}
                  />
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.actions}>
              {record.status === 'hadir' && onCancel ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Batalkan Presensi"
                  onPress={() => {
                    onCancel(record, reason.trim());
                    close();
                  }}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelButtonText}>Batalkan Presensi</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Text style={styles.closeButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(60, 15, 35, 0.42)',
  },
  sheet: {
    maxHeight: '90%',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCopy: {
    gap: 2,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  title: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  content: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  identity: {
    gap: 3,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  meta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  audit: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
  },
  auditTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  cancelSection: {
    gap: spacing.xs,
  },
  cancelLabel: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  reasonInput: {
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  cancelButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  closeButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  closeButtonText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
  },
});
