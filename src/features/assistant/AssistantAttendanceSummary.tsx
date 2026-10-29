import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Attendance, Praktikan, SessionStatus } from '../../types';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import {
  AttendanceRecapItem,
  calculateAttendanceStats,
  deriveAttendanceRecap,
} from './assistant.utils';

type Props = {
  sessionId: string;
  sessionStatus: SessionStatus;
  attendances: Attendance[];
  enrolledPraktikans: Praktikan[];
};

export default function AssistantAttendanceSummary({
  sessionId,
  sessionStatus,
  attendances,
  enrolledPraktikans,
}: Props) {
  const recapItems = useMemo(
    () => deriveAttendanceRecap(
      sessionId,
      attendances,
      enrolledPraktikans,
      sessionStatus === 'ditutup',
    ),
    [sessionId, sessionStatus, attendances, enrolledPraktikans]
  );

  const stats = useMemo(
    () => calculateAttendanceStats(recapItems),
    [recapItems]
  );

  return (
    <View style={styles.container}>
      <View style={styles.statsCard}>
        <Text style={styles.statsEyebrow}>STATISTIK KEHADIRAN</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, styles.statBoxIzin]}>
            <Text style={[styles.statNumber, styles.statIzinNumber]}>{stats.izin}</Text>
            <Text style={styles.statLabel}>Izin</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxIzin]}>
            <Text style={[styles.statNumber, styles.statIzinNumber]}>{stats.sakit}</Text>
            <Text style={styles.statLabel}>Sakit</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxBelum]}>
            <Text style={[styles.statNumber, styles.statBelumNumber]}>
              {sessionStatus === 'ditutup' ? stats.alpha : stats.belumPresensi}
            </Text>
            <Text style={styles.statLabel}>
              {sessionStatus === 'ditutup' ? 'Alpha' : 'Belum Presensi'}
            </Text>
          </View>
          <View style={[styles.statBox, styles.statBoxHadir]}>
            <Text style={[styles.statNumber, styles.statHadirNumber]}>{stats.hadir}</Text>
            <Text style={styles.statLabel}>Hadir</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Daftar Presensi Praktikan</Text>
          <Text style={styles.listSubtitle}>
            Menampilkan {recapItems.length} dari {stats.total} mahasiswa
          </Text>
        </View>

        {recapItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Tidak ada data mahasiswa</Text>
            <Text style={styles.emptySubtitle}>
              Belum ada praktikan terdaftar untuk sesi ini.
            </Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {recapItems.map((item: AttendanceRecapItem) => {
              const isPresent = item.status === 'hadir';
              const isExcused = item.status === 'izin' || item.status === 'sakit';
              const statusLabel = item.status === 'hadir'
                ? 'Hadir'
                : item.status === 'sakit'
                  ? 'Sakit'
                  : item.status === 'izin'
                    ? 'Izin'
                    : item.status === 'alpha'
                      ? 'Alpha'
                      : 'Belum Presensi';

              return (
                <View key={item.praktikanId} style={styles.participantRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.praktikanName.charAt(0)}</Text>
                  </View>

                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{item.praktikanName}</Text>
                    <Text style={styles.participantCode}>
                      {item.studentCode ? `NIM ${item.studentCode}` : `Semester ${item.semester}`}
                    </Text>
                  </View>

                  <View style={styles.statusCol}>
                    <View
                      style={[
                        styles.badge,
                        isPresent
                          ? styles.badgeHadir
                          : isExcused
                            ? styles.badgeIzin
                            : styles.badgeBelum,
                      ]}
                    >
                      <Ionicons
                        name={
                          isPresent
                            ? 'checkmark-circle'
                            : isExcused
                              ? 'document-text-outline'
                              : 'time-outline'
                        }
                        size={12}
                        color={isPresent ? '#15803d' : isExcused ? colors.primaryDark : '#854d0e'}
                      />
                      <Text
                        style={[
                          styles.badgeText,
                          isPresent
                            ? styles.badgeTextHadir
                            : isExcused
                              ? styles.badgeTextIzin
                              : styles.badgeTextBelum,
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                    {item.formattedTime && (
                      <Text style={styles.timeText}>{item.formattedTime}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  statsEyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statBox: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 76,
    backgroundColor: colors.primarySofter,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statBoxHadir: {
    backgroundColor: '#f0fdf4',
  },
  statBoxBelum: {
    backgroundColor: '#fefce8',
  },
  statBoxIzin: {
    backgroundColor: colors.primarySoft,
  },
  statNumber: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  statHadirNumber: {
    color: '#15803d',
  },
  statBelumNumber: {
    color: '#ca8a04',
  },
  statIzinNumber: {
    color: colors.primaryDark,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  listHeader: {
    gap: 2,
  },
  listTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  listSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  itemList: {
    gap: spacing.xs,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  participantInfo: {
    flex: 1,
    gap: 2,
  },
  participantName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  participantCode: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  statusCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeHadir: {
    backgroundColor: '#dcfce7',
  },
  badgeBelum: {
    backgroundColor: '#fef9c3',
  },
  badgeIzin: {
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  badgeTextHadir: {
    color: '#15803d',
  },
  badgeTextBelum: {
    color: '#854d0e',
  },
  badgeTextIzin: {
    color: colors.primaryDark,
  },
  timeText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
});
