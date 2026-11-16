import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  subscribeToAttendance,
  type AttendanceRecord,
} from '../services/attendanceService';
import { colors, fonts, radius, shadows, spacing } from '../theme';
import { formatTime } from '../utils/format';

type Props = {
  sessionId: string;
  title?: string;
  emptyMessage?: string;
  showStats?: boolean;
};

type ListenerState = {
  records: AttendanceRecord[];
  loading: boolean;
  error: string | null;
};

export default function AttendanceSummary({
  sessionId,
  title = 'Rekap Presensi',
  emptyMessage = 'Belum ada praktikan yang melakukan presensi pada sesi ini.',
  showStats = true,
}: Props) {
  const [state, setState] = useState<ListenerState>({
    records: [],
    loading: true,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeToAttendance(
      sessionId,
      (records) => {
        if (!active) return;
        setState({ records, loading: false, error: null });
      },
      (message) => {
        if (!active) return;
        setState({ records: [], loading: false, error: message });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [sessionId, reloadKey]);

  const stats = useMemo(() => {
    const hadir = state.records.filter((record) => record.status !== 'izin').length;
    return { hadir, izin: state.records.length - hadir };
  }, [state.records]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>REALTIME</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {showStats ? (
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxHadir]}>
            <Text style={[styles.statValue, styles.statValueHadir]}>{stats.hadir}</Text>
            <Text style={styles.statLabel}>Hadir</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxIzin]}>
            <Text style={[styles.statValue, styles.statValueIzin]}>{stats.izin}</Text>
            <Text style={styles.statLabel}>Izin</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{state.records.length}</Text>
            <Text style={styles.statLabel}>Tercatat</Text>
          </View>
        </View>
      ) : null}

      {state.loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Memuat rekap presensi...</Text>
        </View>
      ) : state.error ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
          <Text style={styles.stateTitle}>Rekap tidak dapat dimuat</Text>
          <Text style={styles.stateText}>{state.error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Coba muat ulang rekap presensi"
            onPress={() => {
              setState({ records: [], loading: true, error: null });
              setReloadKey((value) => value + 1);
            }}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Coba Lagi</Text>
          </Pressable>
        </View>
      ) : state.records.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="people-outline" size={30} color={colors.textSecondary} />
          <Text style={styles.stateTitle}>Belum ada presensi</Text>
          <Text style={styles.stateText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {state.records.map((record) => {
            const isPresent = record.status !== 'izin';
            return (
              <View key={record.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {record.praktikanName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.name}>{record.praktikanName}</Text>
                  <Text style={styles.time}>
                    {record.attendedAt
                      ? `Presensi pukul ${formatTime(record.attendedAt)} WIB`
                      : 'Waktu presensi tidak tercatat'}
                  </Text>
                </View>
                <View style={[styles.badge, isPresent ? styles.badgeHadir : styles.badgeIzin]}>
                  <Ionicons
                    name={isPresent ? 'checkmark-circle' : 'document-text-outline'}
                    size={12}
                    color={isPresent ? '#15803d' : colors.primaryDark}
                  />
                  <Text
                    style={[
                      styles.badgeText,
                      isPresent ? styles.badgeTextHadir : styles.badgeTextIzin,
                    ]}
                  >
                    {isPresent ? 'Hadir' : 'Izin'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.success,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  statBoxHadir: {
    backgroundColor: '#f0fdf4',
  },
  statBoxIzin: {
    backgroundColor: colors.primarySoft,
  },
  statValue: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  statValueHadir: {
    color: '#15803d',
  },
  statValueIzin: {
    color: colors.primaryDark,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
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
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  time: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
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
    backgroundColor: colors.successBg,
  },
  badgeIzin: {
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  badgeTextHadir: {
    color: '#15803d',
  },
  badgeTextIzin: {
    color: colors.primaryDark,
  },
});
