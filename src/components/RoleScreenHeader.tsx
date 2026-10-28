import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, shadows, spacing } from '../theme';

type Props = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
};

export default function RoleScreenHeader({ title, eyebrow, subtitle, onBack }: Props) {
  const handleChangeRole = () => {
    router.push({ pathname: '/role', params: { from: 'switch' } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primaryDeep} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.brand}>TandaIU</Text>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Ganti peran"
          style={styles.switchButton}
          onPress={handleChangeRole}
          activeOpacity={0.85}
        >
          <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
          <Text style={styles.switchLabel}>Ganti Peran</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heading}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  topRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 22,
    lineHeight: 28,
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  switchButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  switchLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primaryDark,
  },
  heading: {
    marginTop: spacing.lg,
    gap: 2,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 32,
    color: colors.primaryDeep,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
