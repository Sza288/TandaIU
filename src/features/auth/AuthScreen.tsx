import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandWordmark from '../../components/BrandWordmark';
import AuthIllustration from './AuthIllustration';
import { colors, fonts, radius, spacing } from '../../theme';

type AuthScreenProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthScreen({ title, subtitle, children, footer }: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.brandRow}>
              <BrandWordmark size={27} />
              <Text style={styles.brandCaption}>PRESENSI PRAKTIKUM</Text>
            </View>

            <View style={styles.heading}>
              <View style={styles.headingCopy}>
                <Text style={styles.headingTitle}>{title}</Text>
                <Text style={styles.headingSubtitle}>{subtitle}</Text>
              </View>
              <AuthIllustration size={76} />
            </View>
            <View style={styles.form}>{children}</View>
            <View style={styles.footer}>{footer}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthTextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  accessibilityLabel: string;
  textContentType?: 'name' | 'emailAddress' | 'password' | 'newPassword' | 'none';
  returnKeyType?: 'done' | 'next' | 'go';
  onSubmitEditing?: () => void;
  editable?: boolean;
};

export function AuthTextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = 'default',
  autoCapitalize = 'none',
  secureTextEntry = false,
  accessibilityLabel,
  textContentType = 'none',
  returnKeyType = 'next',
  onSubmitEditing,
  editable = true,
}: AuthTextFieldProps) {
  const [passwordVisible, setPasswordVisible] = usePasswordVisibility(secureTextEntry);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Ionicons name={icon} size={19} color={colors.primary} />
        <TextInput
          accessibilityLabel={accessibilityLabel}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry && !passwordVisible}
          style={styles.input}
          textContentType={textContentType}
          value={value}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            hitSlop={8}
            onPress={() => setPasswordVisible(!passwordVisible)}
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function usePasswordVisibility(isPasswordField: boolean): [boolean, (value: boolean) => void] {
  const [visible, setVisible] = useState(false);
  return [isPasswordField && visible, setVisible];
}

export function AuthNotice({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <Ionicons name="information-circle-outline" size={19} color={colors.primaryDark} />
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Ionicons name="alert-circle-outline" size={19} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.success}>
      <Ionicons name="checkmark-circle-outline" size={19} color={colors.success} />
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

type AuthSubmitButtonProps = {
  label: string;
  loading: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function AuthSubmitButton({
  label,
  loading,
  onPress,
  disabled = false,
}: AuthSubmitButtonProps) {
  const unavailable = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, unavailable && styles.loading]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textOnPrimary} />
      ) : (
        <>
          <Text style={styles.submitLabel}>{label}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.textOnPrimary} />
        </>
      )}
    </Pressable>
  );
}

type AuthGoogleButtonProps = {
  label: string;
  loading: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function AuthGoogleButton({
  label,
  loading,
  onPress,
  disabled = false,
}: AuthGoogleButtonProps) {
  const unavailable = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.googleButton,
        pressed && styles.pressed,
        unavailable && styles.loading,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={styles.googleMark}>G</Text>
          <Text style={styles.googleLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

type AuthLinkProps = {
  label: string;
  linkText: string;
  onPress: () => void;
};

export function AuthLink({ label, linkText, onPress }: AuthLinkProps) {
  return (
    <View style={styles.linkRow}>
      <Text style={styles.linkLabel}>{label}</Text>
      <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
        <Text style={styles.linkText}>{linkText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
  },
  brandCaption: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  heading: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headingCopy: {
    flex: 1,
  },
  headingMascot: {
    width: 68,
    height: 68,
  },
  headingTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.brand,
    fontSize: 27,
    lineHeight: 35,
  },
  headingSubtitle: {
    maxWidth: 340,
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  form: {
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  field: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  inputRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  inputRowFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySofter,
  },
  noticeText: {
    flex: 1,
    color: colors.primaryDeep,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  success: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.successBg,
  },
  successText: {
    flex: 1,
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  googleButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  googleMark: {
    color: '#4285F4',
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  googleLabel: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  submitLabel: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  loading: {
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.82,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 40,
    paddingHorizontal: spacing.xs,
  },
  linkLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  linkText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
