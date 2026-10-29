import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, radius, shadows, spacing } from '../theme';

export function DashboardReminder({ message }: { message: string }) {
  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderCopy}>
        <View style={styles.reminderTag}>
          <Ionicons name="notifications" size={14} color={colors.primaryDark} />
          <Text style={styles.reminderTagText}>REMINDER</Text>
        </View>
        <Text style={styles.reminderText}>{message}</Text>
      </View>
      <View style={styles.reminderArtwork} pointerEvents="none">
        <Svg width="80" height="80" viewBox="0 0 72 72">
          <Path
            d="M12 17l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4zm48 32l1.5 3 3 1.5-3 1.5L60 58l-1.5-3-3-1.5 3-1.5L60 49z"
            fill={colors.primary}
            opacity={0.55}
          />
          <Circle cx="59" cy="16" r="2" fill={colors.primary} opacity={0.55} />
        </Svg>
        <Ionicons
          name="notifications-outline"
          size={56}
          color={colors.primaryDark}
          style={styles.reminderBell}
        />
      </View>
    </View>
  );
}

export function SupportContactCard({ title }: { title: string }) {
  return (
    <View style={styles.supportCard}>
      <Text style={styles.supportEyebrow}>{title}</Text>
      <View style={styles.supportBody}>
        <View style={styles.supportIcon}>
          <Ionicons name="flask-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.supportCopy}>
          <Text style={styles.supportName}>Gege Centiana Putra</Text>
          <Text style={styles.supportRole}>Asisten Laboratorium</Text>
          <Text style={styles.supportNumber} selectable={false}>628875619354</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reminderCard: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    ...shadows.card,
  },
  reminderCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  reminderTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  reminderTagText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  reminderText: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  reminderArtwork: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBell: {
    position: 'absolute',
    opacity: 0.42,
  },
  supportCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  supportEyebrow: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  supportBody: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  supportIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  supportCopy: {
    flex: 1,
    gap: 2,
  },
  supportName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  supportRole: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  supportNumber: {
    marginTop: 2,
    color: colors.primaryDark,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
