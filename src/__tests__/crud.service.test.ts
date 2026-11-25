import { addDoc, getDoc, getDocs, setDoc } from 'firebase/firestore';

import { dosen } from '../data/dosen';
import {
  createSession,
  getAllLaboratories,
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
  documentId: jest.fn(() => '__name__'),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({
  auth: {
    currentUser: {
      uid: 'assistant-1',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { assistantSemesterParity: 'ganjil' } }),
    },
  },
  db: {},
}));

const validSession: SessionInput = {
  classId: 'c1',
  courseId: 'struktur-data',
  practicumName: 'Praktikum Struktur Data',
  className: 'A1',
  startsAt: '2026-10-27T08:00:00+07:00',
  endsAt: '2026-10-27T10:00:00+07:00',
  status: 'terjadwal',
  lecturerId: dosen[0].id,
  lecturer: dosen[0].name,
  laboratoryId: 'lab-b',
};

const validSchedule: ScheduleInput = {
  classId: 'c1',
  courseId: 'struktur-data',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  laboratoryId: 'lab-b',
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
    expect(() => validateSessionInput({ ...validSession, classId: '' })).toThrow();
    expect(() => validateSessionInput({ ...validSession, classId: '   ' })).toThrow();
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
    const sessionInput = { ...validSession, laboratoryId: 'lab-1' };
    (getDoc as jest.Mock).mockResolvedValue({
      id: validSession.laboratoryId,
      exists: () => true,
      data: () => ({ name: 'Lab B' }),
    });
    (getDocs as jest.Mock)
      .mockResolvedValueOnce({
        docs: [
          {
            id: validSession.classId,
            data: () => ({
              courseId: validSession.courseId,
              className: validSession.className,
              createdAt: '2026-10-01T00:00:00+07:00',
              semester: 3,
              semesterParity: 'ganjil',
              assistantUid: 'assistant-1',
            }),
          },
        ],
      })
      .mockResolvedValue({ docs: [] });
    (addDoc as jest.Mock).mockResolvedValue({ id: 's1' });

    await expect(createSession(sessionInput)).resolves.toMatchObject({ id: 's1' });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const writtenSession = (addDoc as jest.Mock).mock.calls[0][1];
    expect(writtenSession.laboratoryId).toBe('lab-1');
    expect(writtenSession.startsAt).toBeInstanceOf(Date);
    expect(writtenSession.endsAt).toBeInstanceOf(Date);
    expect(writtenSession.startsAt.getTime()).toBe(Date.parse(validSession.startsAt));
    expect(writtenSession.endsAt.getTime()).toBe(Date.parse(validSession.endsAt));
  });
});

describe('laboratory reader', () => {
  it('maps the shared laboratory contract for session selection', async () => {
    const createdAt = new Date('2026-10-27T08:00:00.000Z');
    const updatedAt = new Date('2026-10-28T08:00:00.000Z');
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [{
        id: 'lab-b',
        data: () => ({
          name: 'Lab B',
          latitude: -6.9,
          longitude: 110.4,
          radius: 50,
          lantai: 2,
          createdAt,
          updatedAt,
        }),
      }],
    });

    await expect(getAllLaboratories()).resolves.toEqual([{
      id: 'lab-b',
      name: 'Lab B',
      latitude: -6.9,
      longitude: 110.4,
      radius: 50,
      lantai: 2,
      isActive: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    }]);
  });

  it('rejects a laboratory radius outside the shared 1-500 meter range', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [{
        id: 'lab-invalid',
        data: () => ({
          name: 'Lab Invalid',
          latitude: -6.9,
          longitude: 110.4,
          radius: 0.5,
          lantai: '2',
          createdAt: new Date('2026-10-27T08:00:00.000Z'),
          updatedAt: new Date('2026-10-28T08:00:00.000Z'),
        }),
      }],
    });

    await expect(getAllLaboratories()).rejects.toThrow(
      'Data laboratorium lab-invalid tidak valid.',
    );
  });

  it.each([1, 500])('accepts a laboratory radius of %i meters', async (radius) => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [{
        id: 'lab-boundary',
        data: () => ({
          name: 'Lab Boundary',
          latitude: -6.9,
          longitude: 110.4,
          radius,
          lantai: 2,
          createdAt: new Date('2026-10-27T08:00:00.000Z'),
          updatedAt: new Date('2026-10-28T08:00:00.000Z'),
        }),
      }],
    });

    await expect(getAllLaboratories()).resolves.toMatchObject([{
      id: 'lab-boundary',
      radius,
    }]);
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
    expect(() => validateScheduleInput({ ...validSchedule, laboratoryId: '   ' })).toThrow();
    expect(() =>
      validateScheduleInput({ ...validSchedule, endTime: validSchedule.startTime }),
    ).toThrow(/setelah waktu mulai/i);
  });

  it('accepts a valid schedule input', () => {
    expect(() => validateScheduleInput(validSchedule)).not.toThrow();
  });

  it('rejects an invalid jumlahPertemuan', () => {
    expect(() => validateScheduleInput({ ...validSchedule, jumlahPertemuan: 0 })).toThrow(
      /Jumlah pertemuan/i,
    );
    expect(() => validateScheduleInput({ ...validSchedule, jumlahPertemuan: 21 })).toThrow(
      /Jumlah pertemuan/i,
    );
    expect(() => validateScheduleInput({ ...validSchedule, jumlahPertemuan: 2.5 })).toThrow(
      /bulat/i,
    );
    expect(() => validateScheduleInput({ ...validSchedule, jumlahPertemuan: 14 })).not.toThrow();
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
