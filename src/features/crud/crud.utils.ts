import { router, type Href } from 'expo-router';
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

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return trimmed;

  return date.toISOString();
}

function toDateValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayDateValue(): string {
  return toDateValue(new Date());
}

export function splitDateTimeInput(value: string): { date: string; time: string } {
  const normalized = toDateTimeInput(value);
  const [date = '', time = ''] = normalized.split('T');
  return { date, time: time.slice(0, 5) };
}

export function combineDateTime(date: string, time: string): string {
  if (!date || !time) return '';
  return fromDateTimeInput(`${date}T${time}`);
}

export function addHoursToDateTime(
  date: string,
  time: string,
  hours: number,
): { date: string; time: string } {
  const [hour = '0', minute = '0'] = time.split(':');
  const base = new Date(
    `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`,
  );
  if (Number.isNaN(base.getTime())) {
    return { date, time };
  }

  base.setHours(base.getHours() + hours);
  return { date: toDateValue(base), time: toTimeValue(base) };
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
  const date = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(date.getTime())) return value;

  return `${DAY_SHORT_LABELS[date.getDay()]}, ${date.getDate()} ${
    MONTH_SHORT_LABELS[date.getMonth()]
  } ${date.getFullYear()}`;
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

export function returnToManage(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(manageHref('/assistant/manage'));
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

