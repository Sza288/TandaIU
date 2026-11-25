import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { usePermit } from '../../hooks/usePermit';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateTime } from '../../utils/format';
import { PermitStatusBadge } from './PermitBadges';

export default function PermitDetailScreen() {
  const params = useLocalSearchParams<{ permitId?: string | string[] }>();
  const permitId = Array.isArray(params.permitId) ? params.permitId[0] : params.permitId;
  const permit = usePermit(permitId ?? null);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Detail Izin" eyebrow="Pengajuan" />
      <ScrollView contentContainerStyle={styles.content}>
        {!permit ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Pengajuan izin tidak ditemukan atau masih dimuat.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>Izin praktikum</Text>
              <PermitStatusBadge status={permit.status} />
            </View>

            <Text style={styles.label}>Nama praktikan</Text>
            <Text style={styles.value}>{permit.studentName}</Text>

            <Text style={styles.label}>Sesi</Text>
            <Text style={styles.value}>{permit.sessionId}</Text>

            <Text style={styles.label}>Alasan</Text>
            <Text style={styles.value}>{permit.reason}</Text>

            <Text style={styles.label}>Diajukan</Text>
            <Text style={styles.value}>{formatDateTime(permit.createdAt)}</Text>

            {permit.status !== 'pending' && permit.reviewedAt ? (
              <>
                <Text style={styles.label}>Direview</Text>
                <Text style={styles.value}>
                  {formatDateTime(permit.reviewedAt)}
                  {permit.reviewedBy ? ` oleh ${permit.reviewedBy}` : ''}
                </Text>
              </>
            ) : null}
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
    padding: spacing.lg,
  },
  empty: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
