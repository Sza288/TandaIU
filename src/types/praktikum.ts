import { dosen } from '../data/dosen';
import type { PracticumSession, SessionStatus } from '../types';

export type Dosen = (typeof dosen)[number];
export type LecturerId = Dosen['id'];

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ClockTime = `${number}${number}:${number}${number}`;

export type ClassDoc = {
  id: string;
  courseId: string;
  className: string;
  createdAt: string;
  semester?: number;
  semesterParity?: 'ganjil' | 'genap';
  assistantUid?: string;
};

export type ScheduleDoc = {
  id: string;
  classId: string;
  courseId: string;
  dayOfWeek: DayOfWeek;
  startTime: ClockTime;
  endTime: ClockTime;
  room: string;
  jumlahPertemuan?: number;
  semesterParity?: 'ganjil' | 'genap';
  assistantUid?: string;
};

export type SessionDoc = PracticumSession & {
  classId: string;
  lecturerId?: LecturerId;
  lecturer?: string;
  semester?: number;
  semesterParity?: 'ganjil' | 'genap';
  assistantUid?: string;
  laboratoryId?: string;
  scheduleId?: string;
};

export type LaboratoryDoc = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  lantai: number;
  /** Laboratorium nonaktif tetap tersimpan, tetapi tidak dapat dipilih untuk sesi. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassInput = Omit<ClassDoc, 'id'>;

export type ScheduleInput = Omit<ScheduleDoc, 'id'>;

export type LaboratoryInput = Omit<LaboratoryDoc, 'id' | 'isActive'>;

export type SessionInput = {
  classId: string;
  courseId: string;
  practicumName: string;
  className: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  lecturerId: LecturerId;
  lecturer: string;
  laboratoryId?: string;
  scheduleId?: string;
};

export const LABORATORY_LIMITS = {
  minRadius: 1,
  maxRadius: 500,
  minLantai: 1,
  maxLantai: 6,
  minLatitude: -90,
  maxLatitude: 90,
  minLongitude: -180,
  maxLongitude: 180,
} as const;

export const COLLECTIONS = {
  classes: 'classes',
  schedules: 'schedules',
  sessions: 'sessions',
  laboratories: 'laboratories',
} as const;
