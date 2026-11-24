import type {
  LaboratoryScheduleRecord,
  LaboratorySessionRecord,
} from '../types/laboratorium';
import { processLaboratoryActivities } from './laboratoryActivities';

const labA = 'lab-a';
const labB = 'lab-b';
const now = Date.parse('2026-11-23T10:00:00+07:00');

function session(
  id: string,
  status: LaboratorySessionRecord['status'],
  overrides: Partial<LaboratorySessionRecord> = {},
): LaboratorySessionRecord {
  return {
    id,
    laboratoryId: labA,
    classId: 'class-a',
    courseId: 'course-a',
    practicumName: 'Praktikum A',
    className: 'Kelas A',
    startsAt: '2026-11-23T08:00:00+07:00',
    endsAt: '2026-11-23T12:00:00+07:00',
    status,
    ...overrides,
  };
}

function schedule(
  id: string,
  overrides: Partial<LaboratoryScheduleRecord> = {},
): LaboratoryScheduleRecord {
  return {
    id,
    laboratoryId: labA,
    classId: 'class-a',
    courseId: 'course-a',
    practicumName: 'Praktikum A',
    className: 'Kelas A',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    ...overrides,
  };
}

describe('processLaboratoryActivities', () => {
  test('menampilkan satu sesi dibuka', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1')],
      [session('x1', 'dibuka')],
      now,
    );
    expect(result.ongoing).toHaveLength(1);
    expect(result.ongoing[0].status).toBe('dibuka');
  });

  test('menampilkan beberapa sesi dibuka', () => {
    const result = processLaboratoryActivities(
      labA,
      [],
      [
        session('x1', 'dibuka', { practicumName: 'Praktikum 1' }),
        session('x2', 'dibuka', { practicumName: 'Praktikum 2' }),
      ],
      now,
    );
    expect(result.ongoing).toHaveLength(2);
  });

  test('menampilkan jadwal yang sedang berlangsung tanpa sesi dibuka', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1')],
      [session('x1', 'terjadwal')],
      now,
    );
    expect(result.ongoing).toHaveLength(1);
  });

  test('sesi ditutup tidak ditampilkan pada rentang jadwal', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1')],
      [session('x1', 'ditutup')],
      now,
    );
    expect(result.ongoing).toHaveLength(0);
  });

  test('tidak ada aktivitas berlangsung', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1', { dayOfWeek: 2 })],
      [],
      now,
    );
    expect(result.ongoing).toHaveLength(0);
  });

  test('memilih jadwal berikutnya', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1', { dayOfWeek: 1, startTime: '13:00', endTime: '15:00' })],
      [],
      now,
    );
    expect(result.next?.scheduleId).toBe('s1');
  });

  test('tidak ada jadwal berikutnya', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1', { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' })],
      [],
      now,
    );
    expect(result.next).toBeNull();
  });

  test('jadwal yang sudah lewat tidak dipilih', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1', { dayOfWeek: 1, startTime: '07:00', endTime: '09:00' })],
      [],
      now,
    );
    expect(result.next).toBeNull();
  });

  test('data laboratorium lain tidak ikut ditampilkan', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1', { laboratoryId: labB })],
      [session('x1', 'dibuka', { laboratoryId: labB })],
      now,
    );
    expect(result.ongoing).toHaveLength(0);
  });

  test('sesi dibuka tidak dipilih sebagai jadwal berikutnya', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1', { dayOfWeek: 1, startTime: '13:00', endTime: '15:00', sessionId: 'x1' })],
      [session('x1', 'dibuka', { startsAt: '2026-11-23T13:00:00+07:00', endsAt: '2026-11-23T15:00:00+07:00' })],
      now,
    );
    expect(result.next).toBeNull();
  });

  test('sesi ditutup tidak dipilih sebagai jadwal berikutnya', () => {
    const result = processLaboratoryActivities(
      labA,
      [schedule('s1', { dayOfWeek: 1, startTime: '13:00', endTime: '15:00', sessionId: 'x1' })],
      [session('x1', 'ditutup', { startsAt: '2026-11-23T13:00:00+07:00', endsAt: '2026-11-23T15:00:00+07:00' })],
      now,
    );
    expect(result.next).toBeNull();
  });

  test('jadwal mendatang terdekat dipilih', () => {
    const result = processLaboratoryActivities(
      labA,
      [
        schedule('later', { dayOfWeek: 1, startTime: '15:00', endTime: '17:00' }),
        schedule('nearest', { dayOfWeek: 1, startTime: '13:00', endTime: '15:00' }),
      ],
      [],
      now,
    );
    expect(result.next?.scheduleId).toBe('nearest');
  });
});
