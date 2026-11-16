import { addDoc, setDoc } from 'firebase/firestore';

import { dosen } from '../data/dosen';
import {
  createSession,
  validateClassInput,
  validateScheduleInput,
  validateSessionInput,
} from '../services/practicumService';
import type {
  ClassInput,
  LecturerId,
  ScheduleInput,
  SessionInput,
} from '../types/praktikum';

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({ db: {} }));

const validSession: SessionInput = {
  courseId: 'struktur-data',
  practicumName: 'Praktikum Struktur Data',
  className: 'A1',
  startsAt: '2026-10-27T08:00:00+07:00',
  endsAt: '2026-10-27T10:00:00+07:00',
  status: 'terjadwal',
  lecturerId: dosen[0].id,
  lecturer: dosen[0].name,
};

const validSchedule: ScheduleInput = {
  classId: 'c1',
  courseId: 'struktur-data',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  room: 'Lab A',
};

const validClass: ClassInput = {
  courseId: 'struktur-data',
  className: 'A1',
  createdAt: '2026-10-27T08:00:00+07:00',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateSessionInput', () => {
  it('rejects endsAt before startsAt', () => {
    expect(() =>
      validateSessionInput({
        ...validSession,
        endsAt: '2026-10-27T07:00:00+07:00',
      }),
    ).toThrow(/setelah waktu mulai/i);
  });

  it('rejects endsAt equal to startsAt', () => {
    expect(() =>
      validateSessionInput({ ...validSession, endsAt: validSession.startsAt }),
    ).toThrow(/setelah waktu mulai/i);
  });

  it('rejects invalid ISO dates', () => {
    expect(() =>
      validateSessionInput({ ...validSession, startsAt: 'bukan-tanggal' }),
    ).toThrow(/ISO/i);
    expect(() =>
      validateSessionInput({ ...validSession, endsAt: '2026-13-01T08:00:00+07:00' }),
    ).toThrow(/ISO/i);
    expect(() =>
      validateSessionInput({ ...validSession, startsAt: '2026-10-27' }),
    ).toThrow(/ISO/i);
  });

  it('rejects empty or whitespace-only fields', () => {
    expect(() => validateSessionInput({ ...validSession, courseId: '' })).toThrow();
    expect(() => validateSessionInput({ ...validSession, courseId: '   ' })).toThrow();
    expect(() =>
      validateSessionInput({ ...validSession, practicumName: '' }),
    ).toThrow();
    expect(() =>
      validateSessionInput({ ...validSession, practicumName: '   ' }),
    ).toThrow();
    expect(() => validateSessionInput({ ...validSession, className: '' })).toThrow();
    expect(() => validateSessionInput({ ...validSession, className: '   ' })).toThrow();
  });

  it('accepts a valid session input', () => {
    expect(() => validateSessionInput(validSession)).not.toThrow();
  });
});

describe('createSession lecturer validation', () => {
  it('rejects a lecturerId outside src/data/dosen.ts before writing', async () => {
    const input = {
      ...validSession,
      lecturerId: 'dos-99' as unknown as LecturerId,
      lecturer: 'Dosen Tidak Dikenal',
    };

    await expect(createSession(input)).rejects.toThrow();

    expect(addDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('writes once for a valid session input', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 's1' });

    await expect(createSession(validSession)).resolves.toMatchObject({ id: 's1' });

    expect(addDoc).toHaveBeenCalledTimes(1);
  });
});

describe('validateScheduleInput', () => {
  it('rejects invalid HH:mm times', () => {
    expect(() =>
      validateScheduleInput({ ...validSchedule, startTime: '8:00' } as unknown as ScheduleInput),
    ).toThrow(/HH:mm/i);
    expect(() =>
      validateScheduleInput({ ...validSchedule, startTime: '24:00' } as unknown as ScheduleInput),
    ).toThrow(/HH:mm/i);
    expect(() =>
      validateScheduleInput({ ...validSchedule, endTime: '10:60' } as unknown as ScheduleInput),
    ).toThrow(/HH:mm/i);
  });

  it('rejects dayOfWeek outside 0-6', () => {
    expect(() =>
      validateScheduleInput({ ...validSchedule, dayOfWeek: -1 } as unknown as ScheduleInput),
    ).toThrow(/0 sampai 6/i);
    expect(() =>
      validateScheduleInput({ ...validSchedule, dayOfWeek: 7 } as unknown as ScheduleInput),
    ).toThrow(/0 sampai 6/i);
    expect(() =>
      validateScheduleInput({ ...validSchedule, dayOfWeek: 1.5 } as unknown as ScheduleInput),
    ).toThrow(/0 sampai 6/i);
  });

  it('rejects empty fields and times that do not advance', () => {
    expect(() => validateScheduleInput({ ...validSchedule, room: '   ' })).toThrow();
    expect(() =>
      validateScheduleInput({ ...validSchedule, endTime: validSchedule.startTime }),
    ).toThrow(/setelah waktu mulai/i);
  });

  it('accepts a valid schedule input', () => {
    expect(() => validateScheduleInput(validSchedule)).not.toThrow();
  });
});

describe('validateClassInput', () => {
  it('rejects empty or whitespace-only fields', () => {
    expect(() => validateClassInput({ ...validClass, courseId: '' })).toThrow();
    expect(() => validateClassInput({ ...validClass, courseId: '   ' })).toThrow();
    expect(() => validateClassInput({ ...validClass, className: '' })).toThrow();
    expect(() => validateClassInput({ ...validClass, className: '   ' })).toThrow();
    expect(() => validateClassInput({ ...validClass, createdAt: '   ' })).toThrow();
  });

  it('rejects an invalid createdAt', () => {
    expect(() =>
      validateClassInput({ ...validClass, createdAt: 'bukan-tanggal' }),
    ).toThrow(/valid/i);
  });

  it('accepts a valid class input', () => {
    expect(() => validateClassInput(validClass)).not.toThrow();
  });
});
