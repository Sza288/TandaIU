import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '../../theme';
import { buildDateOptions, formatDateLabel } from './crud.utils';
import { FormField } from './FormField';
import OptionPicker from './OptionPicker';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => {
  const value = String(index).padStart(2, '0');
  return { label: value, value };
});

const MINUTE_OPTIONS = ['00', '15', '30', '45'].map((value) => ({
  label: value,
  value,
}));

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  placeholder?: string;
};

const webInputStyle: CSSProperties = {
  width: '100%',
  minHeight: 46,
  boxSizing: 'border-box',
  padding: '8px 12px',
  borderRadius: radius.md,
  border: `1px solid ${colors.borderStrong}`,
  backgroundColor: colors.surface,
  color: colors.text,
  fontFamily: fonts.regular,
  fontSize: 14,
  colorScheme: 'light',
};

export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = 'Pilih tanggal',
}: FieldProps) {
  const [visible, setVisible] = useState(false);

  const options = useMemo(() => {
    const base = buildDateOptions();
    if (value && !base.some((option) => option.value === value)) {
      return [{ label: formatDateLabel(value), value }, ...base];
    }
    return base;
  }, [value]);

  if (Platform.OS === 'web') {
    return (
      <FormField label={label} error={error} hint={hint}>
        <input
          type="date"
          value={value}
          aria-label={label}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
          style={error ? { ...webInputStyle, borderColor: colors.danger } : webInputStyle}
        />
      </FormField>
    );
  }

  return (
    <>
      <FormField label={label} error={error} hint={hint}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setVisible(true)}
          style={({ pressed }) => [
            styles.picker,
            error ? styles.fieldError : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text
            style={[styles.pickerValue, !value ? styles.placeholder : null]}
            numberOfLines={2}
          >
            {value ? formatDateLabel(value) : placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </Pressable>
      </FormField>

      <OptionPicker
        visible={visible}
        title={`Pilih ${label}`}
        options={options}
        selectedValue={value}
        onSelect={onChange}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = 'Pilih jam',
}: FieldProps) {
  const [hourPickerVisible, setHourPickerVisible] = useState(false);
  const [minutePickerVisible, setMinutePickerVisible] = useState(false);

  const [hour = '', minute = ''] = value ? value.split(':') : [];

  const minuteOptions = useMemo(() => {
    if (!minute || MINUTE_OPTIONS.some((option) => option.value === minute)) {
      return MINUTE_OPTIONS;
    }
    return [...MINUTE_OPTIONS, { label: minute, value: minute }].sort((a, b) =>
      a.value.localeCompare(b.value),
    );
  }, [minute]);

  const updateHour = (nextHour: string) => {
    onChange(`${nextHour}:${minute || '00'}`);
  };

  const updateMinute = (nextMinute: string) => {
    onChange(`${hour || '00'}:${nextMinute}`);
  };

  if (Platform.OS === 'web') {
    return (
      <FormField label={label} error={error} hint={hint}>
        <input
          type="time"
          step={900}
          value={value}
          aria-label={label}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value.slice(0, 5))
          }
          style={error ? { ...webInputStyle, borderColor: colors.danger } : webInputStyle}
        />
      </FormField>
    );
  }

  return (
    <>
      <FormField label={label} error={error} hint={hint}>
        <View style={styles.timeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}, jam`}
            onPress={() => setHourPickerVisible(true)}
            style={({ pressed }) => [
              styles.timeBox,
              error ? styles.fieldError : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.timeCopy}>
              <Text style={styles.timeCaption}>Jam</Text>
              <Text style={[styles.timeValue, !hour ? styles.placeholder : null]}>
                {hour || '--'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>

          <Text style={styles.timeSeparator}>:</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}, menit`}
            onPress={() => setMinutePickerVisible(true)}
            style={({ pressed }) => [
              styles.timeBox,
              error ? styles.fieldError : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.timeCopy}>
              <Text style={styles.timeCaption}>Menit</Text>
              <Text style={[styles.timeValue, !minute ? styles.placeholder : null]}>
                {minute || '--'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </FormField>

      <OptionPicker
        visible={hourPickerVisible}
        title={`${label} - Jam`}
        options={HOUR_OPTIONS}
        selectedValue={hour}
        onSelect={updateHour}
        onClose={() => setHourPickerVisible(false)}
      />

      <OptionPicker
        visible={minutePickerVisible}
        title={`${label} - Menit`}
        options={minuteOptions}
        selectedValue={minute}
        emptyMessage={placeholder}
        onSelect={updateMinute}
        onClose={() => setMinutePickerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  picker: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  pickerValue: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  placeholder: {
    color: colors.textMuted,
  },
  pressed: {
    backgroundColor: colors.primarySofter,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeBox: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  timeCopy: {
    flex: 1,
    gap: 1,
  },
  timeCaption: {
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  timeValue: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  timeSeparator: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
