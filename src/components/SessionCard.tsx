import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import StatusBadge from './StatusBadge';
import { PracticumSession, Role } from '../types';
import { colors, fonts, radius, shadows, spacing } from '../theme';
import { formatTime, formatTimeRange } from '../utils/format';
import { getLabLabel, getMeetingNumber } from '../utils/session';

function detailLabelFor(session: PracticumSession, role: Role | null) {
  if (session.status === 'ditutup') return 'Lihat Detail';
  if (role === 'assistant') return 'Detail Asisten';
  if (role === 'praktikan') return 'Sesi Praktikan';
  return 'Lihat Detail';
}

type Props = {
  session: PracticumSession;
  role: Role | null;
};

export default function SessionCard({ session, role }: Props) {
  const isClosed = session.status === 'ditutup';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/schedule/${session.id}`)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Buka detail ${session.practicumName}`}
    >
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={isClosed ? 'person' : 'book'} size={18} color={colors.primary} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.lab}>{getLabLabel(session)}</Text>
          <Text style={styles.title}>{session.practicumName}</Text>
        </View>
        <StatusBadge status={session.status} />
      </View>

      <Text style={styles.meeting}>Pertemuan {getMeetingNumber(session)}</Text>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.meta}>
          <Ionicons name="time" size={13} color={colors.primary} />
          <Text style={styles.metaText}>
            {isClosed
              ? `Selesai pukul ${formatTime(session.endsAt)} WIB`
              : formatTimeRange(session.startsAt, session.endsAt)}
          </Text>
        </View>
        <Text style={styles.link}>{detailLabelFor(session, role)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
    gap: 2,
  },
  lab: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  meeting: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  metaText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  link: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
});
