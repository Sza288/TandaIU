import { router, type Href, type ImperativeRouter } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { courses } from '../../data/courses';
import { dosen } from '../../data/dosen';
import type { ClockTime, DayOfWeek, LecturerId } from '../../types/praktikum';

export const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export const DAY_OPTIONS = DAY_LABELS.map((label, value) => ({
  label,
  value: String(value),
}));

export const SESSION_STATUS_OPTIONS = [
  { label: 'Terjadwal', value: 'terjadwal' },
  { label: 'Dibuka', value: 'dibuka' },
  { label: 'Ditutup', value: 'ditutup' },
];

export const COURSE_OPTIONS = courses.map((course) => ({
  label: course.name,
  description: `Semester ${course.semester}`,
  value: course.id,
}));

export const LECTURER_OPTIONS = dosen.map((lecturer) => ({
  label: lecturer.name,
  description: lecturer.nip,
  value: lecturer.id,
}));

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}

export function getCourseName(courseId: string): string {
  return courses.find((course) => course.id === courseId)?.name ?? courseId;
}

export function getLecturerName(lecturerId?: string | null): string | undefined {
  if (!lecturerId) return undefined;
  return dosen.find((lecturer) => lecturer.id === lecturerId)?.name;
}

export function toLecturerId(value: string): LecturerId {
  return value as LecturerId;
}

export function toDayOfWeek(value: string): DayOfWeek {
  return Number(value) as DayOfWeek;
}

export function toClockTime(value: string): ClockTime {
  return value.trim() as ClockTime;
}

export function toDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = jakartaDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromDateTimeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return trimmed;
  const [, year, month, day, hour, minute, second = '0'] = match;
  const wallParts = {
    year: Number(year), month: Number(month), day: Number(day),
    hour: Number(hour), minute: Number(minute), second: Number(second),
  };
  if (!isValidWallTime(wallParts)) return trimmed;

  const wallAsUtc = Date.UTC(
    wallParts.year, wallParts.month - 1, wallParts.day,
    wallParts.hour, wallParts.minute, wallParts.second,
  );
  let instant = wallAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = jakartaDateParts(new Date(instant), true);
    const actualAsUtc = Date.UTC(
      Number(actual.year), Number(actual.month) - 1, Number(actual.day),
      Number(actual.hour), Number(actual.minute), Number(actual.second),
    );
    const correction = wallAsUtc - actualAsUtc;
    instant += correction;
    if (correction === 0) break;
  }
  const result = new Date(instant);
  const roundTrip = jakartaDateParts(result, true);
  if (!sameWallTime(wallParts, roundTrip)) return trimmed;
  return result.toISOString();
}

type JakartaWallParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function jakartaDateParts(date: Date, includeSeconds = false): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', ...(includeSeconds ? { second: '2-digit' } : {}),
    hourCycle: 'h23',
  });
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

function isValidWallTime(value: JakartaWallParts): boolean {
  if (value.hour > 23 || value.minute > 59 || value.second > 59) return false;
  const check = new Date(Date.UTC(value.year, value.month - 1, value.day));
  return check.getUTCFullYear() === value.year
    && check.getUTCMonth() === value.month - 1
    && check.getUTCDate() === value.day;
}

function sameWallTime(expected: JakartaWallParts, actual: Record<string, string>): boolean {
  return expected.year === Number(actual.year)
    && expected.month === Number(actual.month)
    && expected.day === Number(actual.day)
    && expected.hour === Number(actual.hour)
    && expected.minute === Number(actual.minute)
    && expected.second === Number(actual.second);
}

function toDateValue(date: Date): string {
  const parts = jakartaDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayDateValue(): string {
  return toDateValue(new Date());
}

export function splitDateTimeInput(value: string): { date: string; time: string } {
  const normalized = toDateTimeInput(value);
  const [date = '', time = ''] = normalized.split('T');
  return { date, time: time.slice(0, 5) };
}

export function combineDateTime(date: string, time: string, originalValue?: string): string {
  if (!date || !time) return '';
  if (originalValue) {
    const originalInput = toDateTimeInput(originalValue);
    if (originalInput === `${date}T${time}`) return originalValue;
  }
  return fromDateTimeInput(`${date}T${time}`);
}

export function addHoursToDateTime(
  date: string,
  time: string,
  hours: number,
): { date: string; time: string } {
  const [hour = '0', minute = '0'] = time.split(':');
  const baseWall = `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
  const base = new Date(fromDateTimeInput(baseWall));
  if (Number.isNaN(base.getTime())) {
    return { date, time };
  }

  const wall = jakartaDateParts(base, true);
  const shifted = new Date(Date.UTC(
    Number(wall.year), Number(wall.month) - 1, Number(wall.day),
    Number(wall.hour) + hours, Number(wall.minute), Number(wall.second),
  ));
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

const DAY_SHORT_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_SHORT_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!value || Number.isNaN(date.getTime())) return value;

  return `${DAY_SHORT_LABELS[date.getUTCDay()]}, ${date.getUTCDate()} ${
    MONTH_SHORT_LABELS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

export function fieldForMessage<T extends string>(
  message: string,
  mappings: { field: T; prefix: string }[],
): T | null {
  const mapping = mappings.find((item) => message.startsWith(item.prefix));
  return mapping ? mapping.field : null;
}

export function manageHref(pathname: string, id?: string): Href {
  return { pathname, params: id ? { id } : undefined } as Href;
}

export function goBackOr(navigationRouter: ImperativeRouter, fallback: Href): void {
  if (navigationRouter.canGoBack()) {
    navigationRouter.back();
    return;
  }
  navigationRouter.replace(fallback);
}

export function returnToManage(): void {
  goBackOr(router, manageHref('/assistant/manage'));
}

export function confirmAction({
  title,
  message,
  confirmLabel = 'Hapus',
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Batal', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

