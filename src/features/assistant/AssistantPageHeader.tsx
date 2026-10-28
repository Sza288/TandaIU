import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radius, shadows, spacing } from '../../theme';

type Props = {
  eyebrow: string;
  title: string;
  onBack: () => void;
};

export default function AssistantPageHeader({ eyebrow, title, onBack }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primaryDeep} />
        </TouchableOpacity>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.balance} />
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
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  heading: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  title: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 17,
    textAlign: 'center',
  },
  balance: {
    width: 44,
  },
});
