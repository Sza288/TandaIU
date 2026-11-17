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
};

export type ScheduleDoc = {
  id: string;
  classId: string;
  courseId: string;
  dayOfWeek: DayOfWeek;
  startTime: ClockTime;
  endTime: ClockTime;
  room: string;
};

export type SessionDoc = PracticumSession & {
  classId: string;
  lecturerId?: LecturerId;
  lecturer?: string;
};

export type ClassInput = Omit<ClassDoc, 'id'>;

export type ScheduleInput = Omit<ScheduleDoc, 'id'>;

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
};

export const COLLECTIONS = {
  classes: 'classes',
  schedules: 'schedules',
  sessions: 'sessions',
} as const;
