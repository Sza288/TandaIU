import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
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
import ScreenHeader from '../../../components/ScreenHeader';
import StatusBadge from '../../../components/StatusBadge';
import { attendanceServiceMode, subscribeToSessions } from '../../../services/attendanceService';
import { colors, fonts, radius, shadows, spacing } from '../../../theme';
import type { PracticumSession } from '../../../types';
import { formatDateLong, formatTimeRange } from '../../../utils/format';

const statusRank: Record<PracticumSession['status'], number> = {
  dibuka: 0,
  terjadwal: 1,
  ditutup: 2,
};

export default function AssistantAttendanceScreen() {
  const [sessions, setSessions] = useState<PracticumSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeToSessions(
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

    return () => {
      active = false;
      unsubscribe();
    };
  }, [reloadKey]);

  const orderedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const byStatus = statusRank[a.status] - statusRank[b.status];
        if (byStatus !== 0) return byStatus;
        return a.startsAt.localeCompare(b.startsAt);
      }),
    [sessions],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/assistant');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        eyebrow="Asisten"
        title="Presensi Sesi"
        onBack={handleBack}
      />

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

        <Text style={styles.subtitle}>
          Buka atau tutup sesi, lalu pantau rekap kehadiran praktikan secara realtime.
        </Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Memuat daftar sesi...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
            <Text style={styles.stateTitle}>Daftar sesi tidak dapat dimuat</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Coba muat ulang daftar sesi"
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
        ) : orderedSessions.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="calendar-clear-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.stateTitle}>Belum ada sesi praktikum</Text>
            <Text style={styles.stateText}>
              Sesi yang dibuat dari menu kelola praktikum akan muncul di sini.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {orderedSessions.map((session) => (
              <Pressable
                key={session.id}
                accessibilityRole="button"
                accessibilityLabel={`Kelola presensi ${session.practicumName} kelas ${session.className}`}
                onPress={() =>
                  router.push({
                    pathname: '/assistant/attendance/[sessionId]',
                    params: { sessionId: session.id },
                  } as unknown as Href)
                }
                style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
              >
                <View style={styles.sessionTop}>
                  <View style={styles.sessionIcon}>
                    <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
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

                <View style={styles.sessionFooter}>
                  <Text style={styles.footerHint}>
                    {session.status === 'dibuka'
                      ? 'Sesi sedang dibuka'
                      : session.status === 'terjadwal'
                        ? 'Siap dibuka saat praktikum dimulai'
                        : 'Sesi sudah ditutup'}
                  </Text>
                  <View style={styles.footerAction}>
                    <Text style={styles.footerActionText}>Kelola Presensi</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
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
  sessionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  footerHint: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  footerActionText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 11,
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
