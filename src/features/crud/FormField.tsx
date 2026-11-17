import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';

type FormFieldProps = {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
};

export function FormField({ label, error, hint, children }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type FormTextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function FormTextField({
  label,
  error,
  hint,
  style,
  ...inputProps
}: FormTextFieldProps) {
  return (
    <FormField label={label} error={error} hint={hint}>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />
    </FormField>
  );
}

type FormPickerFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
};

export function FormPickerField({
  label,
  value,
  placeholder,
  error,
  hint,
  disabled = false,
  onPress,
}: FormPickerFieldProps) {
  return (
    <FormField label={label} error={error} hint={hint}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.input,
          styles.picker,
          error ? styles.inputError : null,
          disabled ? styles.pickerDisabled : null,
          pressed && !disabled ? styles.pickerPressed : null,
        ]}
      >
        <Text
          style={[styles.pickerValue, !value ? styles.pickerPlaceholder : null]}
          numberOfLines={2}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
    </FormField>
  );
}

type FormReadOnlyFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  style?: ViewStyle;
};

export function FormReadOnlyField({
  label,
  value,
  placeholder,
  hint,
  style,
}: FormReadOnlyFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      <View style={[styles.input, styles.readOnly, style]}>
        <Text style={[styles.readOnlyText, !value ? styles.readOnlyPlaceholder : null]}>
          {value || placeholder || ''}
        </Text>
      </View>
    </FormField>
  );
}

export function FormNote({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  inputError: {
    borderColor: colors.danger,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerDisabled: {
    opacity: 0.55,
  },
  pickerPressed: {
    backgroundColor: colors.primarySofter,
  },
  pickerValue: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
  },
  readOnly: {
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  readOnlyText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  readOnlyPlaceholder: {
    color: colors.textMuted,
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
  },
});
