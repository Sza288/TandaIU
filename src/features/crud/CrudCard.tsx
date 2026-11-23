import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadows, spacing } from '../../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  eyebrow?: string;
  onEdit: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  children?: ReactNode;
};

export default function CrudCard({
  icon,
  title,
  eyebrow,
  onEdit,
  onDelete,
  deleting = false,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      {children}

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.button,
            styles.editButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Ionicons name="create-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hapus ${title}`}
            disabled={deleting}
            onPress={onDelete}
            style={({ pressed }) => [
              styles.button,
              styles.deleteButton,
              pressed && !deleting ? styles.buttonPressed : null,
              deleting ? styles.buttonDisabled : null,
            ]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.deleteText}>Hapus</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginTop: spacing.xs,
    backgroundColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  editButton: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  deleteButton: {
    borderColor: colors.dangerBg,
    backgroundColor: colors.dangerBg,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  editText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
