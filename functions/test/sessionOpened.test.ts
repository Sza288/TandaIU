import assert from 'node:assert/strict';
import test from 'node:test';
import { handleSessionOpened } from '../src/sessionOpened';
import { createDepsMock } from './depsMock';

const sessionAfter = {
  status: 'dibuka',
  classId: 'c1',
  courseId: 'dasar-pemrograman',
  practicumName: 'Dasar Pemrograman',
  className: 'A',
};

test('sessionOpened mengirim notifikasi untuk terjadwal ke dibuka', async () => {
  const mocks = createDepsMock({
    enrollments: {
      c1: [
        { classId: 'c1', praktikanId: 'u1' },
        { classId: 'c1', praktikanId: 'u2' },
        { classId: 'c1', praktikanId: 'u1' },
      ],
    },
  });

  await handleSessionOpened(
    { sessionId: 'ses-1', change: { before: { status: 'terjadwal' }, after: sessionAfter } },
    mocks.deps,
  );

  assert.deepEqual(mocks.enrollmentCalls, ['c1']);
  assert.deepEqual(mocks.queriedUids, ['u1', 'u2']);
  assert.equal(mocks.sentMessages.length, 2);
  assert.equal(mocks.sentMessages[0].notification.title, 'Sesi dibuka');
  assert.equal(mocks.sentMessages[0].notification.body, 'Dasar Pemrograman (A) sudah dibuka.');
  assert.deepEqual(mocks.sentMessages[0].data, { type: 'session_opened', sessionId: 'ses-1' });
  assert.equal(mocks.sentMessages[0].android.notification.channelId, 'default');
});

test('sessionOpened tidak mengirim untuk transisi lain', async () => {
  const mocks = createDepsMock({
    enrollments: { c1: [{ classId: 'c1', praktikanId: 'u1' }] },
  });

  await handleSessionOpened(
    { sessionId: 'ses-1', change: { before: { status: 'dibuka' }, after: sessionAfter } },
    mocks.deps,
  );

  assert.deepEqual(mocks.enrollmentCalls, []);
  assert.deepEqual(mocks.sentMessages, []);
});

test('sessionOpened mencatat error dan tidak melempar ulang', async () => {
  const mocks = createDepsMock({ failingListEnrollments: true });

  await assert.doesNotReject(
    handleSessionOpened(
      { sessionId: 'ses-1', change: { before: { status: 'terjadwal' }, after: sessionAfter } },
      mocks.deps,
    ),
  );

  assert.equal(mocks.errorMessages.length, 1);
  assert.equal(mocks.errorMessages[0].includes('enrollment boom'), true);
});
