import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { formatDateLabel, todayDateValue } from './crud.utils';
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

const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTH_LABELS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  placeholder?: string;
};

function dateValue(date: Date): string {
  const pad = (item: number) => String(item).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateValue(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthCells(month: Date): Date[] {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = 'Pilih tanggal',
}: FieldProps) {
  const [visible, setVisible] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const today = useMemo(() => todayDateValue(), []);

  const openCalendar = () => {
    setViewMonth(startOfMonth(value ? parseDateValue(value) : new Date()));
    setVisible(true);
  };

  const cells = useMemo(() => getMonthCells(viewMonth), [viewMonth]);

  const moveMonth = (delta: number) => {
    setViewMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  };

  const selectDate = (date: Date) => {
    onChange(dateValue(date));
    setVisible(false);
  };

  const selectToday = () => {
    onChange(today);
    setVisible(false);
  };

  return (
    <>
      <FormField label={label} error={error} hint={hint}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={openCalendar}
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
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        </Pressable>
      </FormField>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            accessibilityLabel="Tutup kalender"
            onPress={() => setVisible(false)}
          />

          <View style={styles.calendar}>
            <View style={styles.calendarHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bulan sebelumnya"
                onPress={() => moveMonth(-1)}
                style={({ pressed }) => [
                  styles.arrowButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.primaryDark} />
              </Pressable>

              <Text style={styles.monthTitle}>
                {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bulan berikutnya"
                onPress={() => moveMonth(1)}
                style={({ pressed }) => [
                  styles.arrowButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((day) => (
                <Text key={day} style={styles.weekdayLabel}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((date) => {
                const cellValue = dateValue(date);
                const isSelected = cellValue === value;
                const isToday = cellValue === today;
                const isOtherMonth =
                  date.getMonth() !== viewMonth.getMonth() ||
                  date.getFullYear() !== viewMonth.getFullYear();

                return (
                  <Pressable
                    key={cellValue}
                    accessibilityRole="button"
                    accessibilityLabel={formatDateLabel(cellValue)}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => selectDate(date)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      isToday ? styles.dayToday : null,
                      isSelected ? styles.daySelected : null,
                      pressed && !isSelected ? styles.dayPressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isOtherMonth ? styles.dayOtherMonth : null,
                        isToday && !isSelected ? styles.dayTodayText : null,
                        isSelected ? styles.daySelectedText : null,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calendarFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pilih hari ini"
                onPress={selectToday}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>Hari ini</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup kalender"
                onPress={() => setVisible(false)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  error,
  hint,
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
    opacity: 0.82,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(60, 15, 35, 0.42)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  calendar: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  arrowButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  monthTitle: {
    flex: 1,
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 16,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  weekdayLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 11,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayCell: {
    width: '13%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayToday: {
    borderColor: colors.primarySoft,
  },
  daySelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayPressed: {
    backgroundColor: colors.primarySofter,
  },
  dayText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  dayOtherMonth: {
    color: colors.textMuted,
  },
  dayTodayText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  daySelectedText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
  },
  calendarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySofter,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 12,
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
