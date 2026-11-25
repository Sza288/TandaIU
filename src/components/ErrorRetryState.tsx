import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadows, spacing } from '../theme';

type Props = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export default function ErrorRetryState({ message, onRetry, retryLabel = 'Coba Lagi' }: Props) {
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.message}>{message}</Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
            onPress={onRetry}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>{retryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dangerBg,
    ...shadows.card,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  copy: {
    flex: 1,
    gap: spacing.sm,
  },
  message: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: colors.textOnPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
