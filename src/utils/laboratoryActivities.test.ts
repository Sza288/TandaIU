import type {
  LaboratoryScheduleRecord,
  LaboratorySessionRecord,
} from '../types/laboratorium';
import { processLaboratoryActivities } from './laboratoryActivities';

const laboratoryId = 'lab-a';
const otherLaboratoryId = 'lab-b';
const now = Date.parse('2026-11-23T10:00:00+07:00');

function session(
  id: string,
  status: LaboratorySessionRecord['status'],
  overrides: Partial<LaboratorySessionRecord> = {},
): LaboratorySessionRecord {
  return {
    id,
    classId: 'class-a',
    courseId: 'course-a',
    practicumName: 'Praktikum A',
    className: 'Kelas A',
    startsAt: '2026-11-23T08:00:00+07:00',
    endsAt: '2026-11-23T12:00:00+07:00',
    status,
    laboratoryId,
    ...overrides,
  };
}

function schedule(
  id: string,
  overrides: Partial<LaboratoryScheduleRecord> = {},
): LaboratoryScheduleRecord {
  return {
    id,
    classId: 'class-a',
    courseId: 'course-a',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    room: 'Ruang A',
    ...overrides,
  };
}

describe('processLaboratoryActivities', () => {
  test('menampilkan sesi dibuka meskipun waktunya sudah lewat', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [session('x1', 'dibuka', {
        startsAt: '2026-11-22T08:00:00+07:00',
        endsAt: '2026-11-22T10:00:00+07:00',
      })],
      now,
    );

    expect(result.ongoing).toHaveLength(1);
    expect(result.ongoing[0].status).toBe('dibuka');
  });

  test('menampilkan semua sesi dibuka dengan urutan mulai', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [
        session('x2', 'dibuka', { startsAt: '2026-11-23T09:00:00+07:00' }),
        session('x1', 'dibuka', { startsAt: '2026-11-23T08:00:00+07:00' }),
      ],
      now,
    );

    expect(result.ongoing.map((activity) => activity.id)).toEqual(['x1', 'x2']);
  });

  test('jadwal sesi terjadwal yang sedang berlangsung tampil dengan statusnya', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [schedule('schedule-1')],
      [session('x1', 'terjadwal')],
      now,
    );

    expect(result.ongoing).toHaveLength(1);
    expect(result.ongoing[0].status).toBe('terjadwal');
    expect(result.ongoing[0].scheduleId).toBeUndefined();
  });

  test('sesi ditutup tidak ditampilkan dalam rentang waktunya', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [session('x1', 'ditutup')],
      now,
    );

    expect(result.ongoing).toHaveLength(0);
  });

  test('tidak menampilkan aktivitas yang tidak berlangsung', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [session('x1', 'terjadwal', {
        startsAt: '2026-11-23T13:00:00+07:00',
        endsAt: '2026-11-23T15:00:00+07:00',
      })],
      now,
    );

    expect(result.ongoing).toHaveLength(0);
  });

  test('memilih sesi terjadwal berikutnya dan melampirkan metadata jadwal', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [schedule('schedule-1', { room: 'Ruang B' })],
      [session('x1', 'terjadwal', {
        startsAt: '2026-11-23T13:00:00+07:00',
        endsAt: '2026-11-23T15:00:00+07:00',
        scheduleId: 'schedule-1',
      })],
      now,
    );

    expect(result.next?.id).toBe('x1');
    expect(result.next?.scheduleId).toBe('schedule-1');
    expect(result.next?.room).toBe('Ruang B');
  });

  test('mengembalikan jadwal kosong bila tidak ada sesi berikutnya', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [schedule('schedule-1')],
      [],
      now,
    );

    expect(result.next).toBeNull();
  });

  test('tidak memilih sesi terjadwal yang telah lewat', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [session('x1', 'terjadwal', {
        startsAt: '2026-11-23T07:00:00+07:00',
        endsAt: '2026-11-23T09:00:00+07:00',
      })],
      now,
    );

    expect(result.next).toBeNull();
  });

  test('tidak menyertakan sesi milik laboratorium lain', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [
        session('x1', 'dibuka', { laboratoryId: otherLaboratoryId }),
        session('x2', 'terjadwal', {
          laboratoryId: otherLaboratoryId,
          startsAt: '2026-11-23T13:00:00+07:00',
          endsAt: '2026-11-23T15:00:00+07:00',
        }),
      ],
      now,
    );

    expect(result.ongoing).toHaveLength(0);
    expect(result.next).toBeNull();
  });

  test('sesi dibuka tidak dipilih sebagai sesi berikutnya', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [session('x1', 'dibuka', {
        startsAt: '2026-11-23T13:00:00+07:00',
        endsAt: '2026-11-23T15:00:00+07:00',
      })],
      now,
    );

    expect(result.ongoing).toHaveLength(1);
    expect(result.next).toBeNull();
  });

  test('sesi ditutup tidak dipilih sebagai sesi berikutnya', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [session('x1', 'ditutup', {
        startsAt: '2026-11-23T13:00:00+07:00',
        endsAt: '2026-11-23T15:00:00+07:00',
      })],
      now,
    );

    expect(result.next).toBeNull();
  });

  test('memilih sesi terjadwal terdekat dari beberapa kandidat', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [
        session('later', 'terjadwal', {
          startsAt: '2026-11-23T15:00:00+07:00',
          endsAt: '2026-11-23T17:00:00+07:00',
        }),
        session('nearest', 'terjadwal', {
          startsAt: '2026-11-23T13:00:00+07:00',
          endsAt: '2026-11-23T15:00:00+07:00',
        }),
      ],
      now,
    );

    expect(result.next?.id).toBe('nearest');
  });

  test('menghindari sesi tanpa waktu valid', () => {
    const result = processLaboratoryActivities(
      laboratoryId,
      [],
      [session('invalid', 'dibuka', { startsAt: 'invalid', endsAt: 'invalid' })],
      now,
    );

    expect(result.ongoing).toHaveLength(0);
    expect(result.next).toBeNull();
  });
});
