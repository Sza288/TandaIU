import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../theme';

type Props = {
  title: string;
  eyebrow?: string;
  submitLabel: string;
  onSubmit: () => void;
  submitting: boolean;
  submitDisabled?: boolean;
  formError?: string | null;
  children: ReactNode;
};

export default function FormScaffold({
  title,
  eyebrow = 'Kelola Praktikum',
  submitLabel,
  onSubmit,
  submitting,
  submitDisabled = false,
  formError,
  children,
}: Props) {
  const disabled = submitting || submitDisabled;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title={title} eyebrow={eyebrow} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}

          {formError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            disabled={disabled}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.submit,
              disabled ? styles.submitDisabled : null,
              pressed && !disabled ? styles.submitPressed : null,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="save-outline" size={17} color={colors.textOnPrimary} />
                <Text style={styles.submitText}>{submitLabel}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FormLoadingScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={title} eyebrow="Kelola Praktikum" />
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  submit: {
    minHeight: 50,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
