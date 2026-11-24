import type { SessionStatus } from '../types';

export type LaboratoryRecord = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  radiusMeters?: number;
};

export type LaboratoryScheduleRecord = {
  id: string;
  laboratoryId?: string;
  classId: string;
  courseId: string;
  practicumName: string;
  className: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: `${number}${number}:${number}${number}`;
  endTime: `${number}${number}:${number}${number}`;
  sessionId?: string;
};

export type LaboratorySessionRecord = {
  id: string;
  laboratoryId?: string;
  classId: string;
  courseId: string;
  practicumName: string;
  className: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
};
