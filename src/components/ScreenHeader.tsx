import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../theme';

type Props = {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  onBack?: () => void;
};

export default function ScreenHeader({ title, eyebrow, right, onBack }: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={styles.iconButton}
        onPress={onBack ?? (() => router.back())}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.center}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.primaryDeep,
  },
  rightSlot: {
    width: 40,
    alignItems: 'flex-end',
  },
});
