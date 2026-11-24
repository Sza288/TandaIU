import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import StatusBadge from '../../components/StatusBadge';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import type { LaboratoryRecord } from '../../types/laboratorium';
import { formatDateTime, formatTime } from '../../utils/format';
import type { LaboratoryActivities } from '../../utils/laboratoryActivities';

type Props = {
  laboratory: LaboratoryRecord;
  activities: LaboratoryActivities | undefined;
  activitiesLoading: boolean;
  activitiesError: string | null;
};

export default function LaboratoryDetails({
  laboratory,
  activities,
  activitiesLoading,
  activitiesError,
}: Props) {
  const hasValidCoordinates =
    Number.isFinite(laboratory.latitude) &&
    Number.isFinite(laboratory.longitude);

  const ongoingActivities = activities?.ongoing ?? [];
  const nextActivity = activities?.next;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.iconBox}>
          <Ionicons name="flask-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.titleCopy}>
          <Text style={styles.eyebrow}>INFORMASI LABORATORIUM</Text>
          <Text style={styles.title}>
            {laboratory.name || 'Nama tidak tersedia'}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={18} color={colors.primary} />
        <Text style={styles.infoText}>
          {hasValidCoordinates
            ? `${laboratory.latitude.toFixed(6)}, ${laboratory.longitude.toFixed(6)}`
            : 'Koordinat tidak tersedia'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="business-outline" size={18} color={colors.primary} />
        <Text style={styles.infoText}>
          Lantai {laboratory.lantai ?? '--'} · Radius {laboratory.radius ?? '--'} m
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Praktikum berlangsung</Text>

        {activitiesLoading ? (
          <View style={styles.stateRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.stateText}>Memuat aktivitas...</Text>
          </View>
        ) : activitiesError ? (
          <Text style={styles.errorText}>{activitiesError}</Text>
        ) : ongoingActivities.length > 0 ? (
          ongoingActivities.map((activity) => (
            <View key={activity.id} style={styles.activity}>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle}>
                  {activity.practicumName || '--'}
                </Text>
                <Text style={styles.activityMeta}>
                  Kelas {activity.className || '--'} · {formatDateTime(activity.startsAt)} - {formatTime(activity.endsAt)} WIB
                </Text>
                {activity.room ? (
                  <Text style={styles.activityMeta}>{activity.room}</Text>
                ) : null}
              </View>
              <StatusBadge status={activity.status} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            Tidak ada praktikum yang sedang berlangsung.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Praktikum berikutnya</Text>

        {activitiesLoading ? (
          <View style={styles.stateRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.stateText}>Memuat jadwal...</Text>
          </View>
        ) : activitiesError ? (
          <Text style={styles.errorText}>{activitiesError}</Text>
        ) : nextActivity ? (
          <View style={styles.activity}>
            <View style={styles.activityCopy}>
              <Text style={styles.activityTitle}>
                {nextActivity.practicumName || '--'}
              </Text>
              <Text style={styles.activityMeta}>
                Kelas {nextActivity.className || '--'} · {formatDateTime(nextActivity.startsAt)} - {formatTime(nextActivity.endsAt)} WIB
              </Text>
              {nextActivity.room ? (
                <Text style={styles.activityMeta}>{nextActivity.room}</Text>
              ) : null}
            </View>
            <StatusBadge status={nextActivity.status} />
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Belum ada jadwal praktikum berikutnya.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  iconBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  titleCopy: { flex: 1, gap: 2 },
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  activityCopy: { flex: 1, gap: 3 },
  activityTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  activityMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
