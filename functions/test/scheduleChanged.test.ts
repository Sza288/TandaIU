import assert from 'node:assert/strict';
import test from 'node:test';
import { handleScheduleChanged } from '../src/scheduleChanged';
import { createDepsMock } from './depsMock';

const before = {
  classId: 'c1',
  courseId: 'k1',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  room: 'Lab A',
};

test('scheduleChanged mengirim ke kelas lama dan baru', async () => {
  const mocks = createDepsMock({
    enrollments: {
      c1: [{ classId: 'c1', praktikanId: 'u1' }],
      c2: [{ classId: 'c2', praktikanId: 'u2' }],
    },
  });
  const after = { ...before, classId: 'c2', room: 'Lab B' };

  await handleScheduleChanged(
    { scheduleId: 'sch-1', change: { before, after } },
    mocks.deps,
  );

  assert.deepEqual(mocks.enrollmentCalls, ['c1', 'c2']);
  assert.deepEqual(mocks.queriedUids, ['u1', 'u2']);
  assert.equal(mocks.sentMessages.length, 2);
  assert.equal(mocks.sentMessages[0].notification.title, 'Jadwal berubah');
  assert.equal(mocks.sentMessages[0].notification.body, 'k1: Kelas berubah, Ruangan berubah.');
  assert.deepEqual(mocks.sentMessages[0].data, {
    type: 'schedule_changed',
    scheduleId: 'sch-1',
  });
});

test('scheduleChanged tidak mengirim bila hanya field non-trigger berubah', async () => {
  const mocks = createDepsMock({
    enrollments: { c1: [{ classId: 'c1', praktikanId: 'u1' }] },
  });

  await handleScheduleChanged(
    { scheduleId: 'sch-1', change: { before, after: { ...before, assistantUid: 'asisten-1' } } },
    mocks.deps,
  );

  assert.deepEqual(mocks.enrollmentCalls, []);
  assert.deepEqual(mocks.sentMessages, []);
});

test('scheduleChanged mencatat error dan tidak melempar ulang', async () => {
  const mocks = createDepsMock({ failingListEnrollments: true });
  const after = { ...before, room: 'Lab B' };

  await assert.doesNotReject(
    handleScheduleChanged({ scheduleId: 'sch-1', change: { before, after } }, mocks.deps),
  );

  assert.equal(mocks.errorMessages.length, 1);
  assert.equal(mocks.errorMessages[0].includes('enrollment boom'), true);
});
