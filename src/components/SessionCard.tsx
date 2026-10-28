import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import PracticumIcon from './PracticumIcon';
import StatusBadge from './StatusBadge';
import { PracticumSession, Role } from '../types';
import { colors, fonts, radius, shadows, spacing } from '../theme';
import { formatDateShort, formatTime, formatTimeRange } from '../utils/format';
import { getCourseById } from '../utils/academic';
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
  const course = getCourseById(session.courseId);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/schedule/[id]', params: { id: session.id } })}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Buka detail ${session.practicumName}`}
    >
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <PracticumIcon practicumName={session.practicumName} size={22} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.lab}>{getLabLabel(session)}</Text>
          <Text style={styles.title}>{session.practicumName}</Text>
        </View>
        <StatusBadge status={session.status} />
      </View>

      <Text style={styles.meeting}>
        {course ? `Semester ${course.semester} · ` : ''}Pertemuan {getMeetingNumber(session)}
      </Text>

      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeItem}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text style={styles.dateTimeText} numberOfLines={1}>
            {formatDateShort(session.startsAt)}
          </Text>
        </View>
        <View style={styles.dateTimeItem}>
          <Ionicons name="time-outline" size={15} color={colors.primary} />
          <Text style={styles.dateTimeText} numberOfLines={1}>
            {isClosed
              ? `Selesai pukul ${formatTime(session.endsAt)} WIB`
              : formatTimeRange(session.startsAt, session.endsAt)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <Text style={styles.link}>{detailLabelFor(session, role)}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.primary} />
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
    width: 42,
    height: 42,
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateTimeItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateTimeText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  link: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
});
