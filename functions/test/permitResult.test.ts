import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePermitResult } from '../src/permitResult';
import { createDepsMock } from './depsMock';

test('permitResult mengirim status Disetujui ke studentId', async () => {
  const mocks = createDepsMock({
    sessions: {
      'ses-1': {
        practicumName: 'Struktur Data',
        courseId: 'struktur-data',
        className: 'C',
      },
    },
  });

  await handlePermitResult(
    {
      permitId: 'p-1',
      change: {
        before: { status: 'pending' },
        after: { status: 'approved', studentId: 'u9', sessionId: 'ses-1' },
      },
    },
    mocks.deps,
  );

  assert.deepEqual(mocks.sessionCalls, ['ses-1']);
  assert.deepEqual(mocks.queriedUids, ['u9']);
  assert.equal(mocks.sentMessages.length, 1);
  assert.equal(mocks.sentMessages[0].notification.title, 'Hasil pengajuan izin');
  assert.equal(
    mocks.sentMessages[0].notification.body,
    'Pengajuan izinmu Disetujui untuk Struktur Data (C).',
  );
  assert.deepEqual(mocks.sentMessages[0].data, { type: 'permit_result', permitId: 'p-1' });
});

test('permitResult mengirim status Ditolak dengan fallback courseId', async () => {
  const mocks = createDepsMock({
    sessions: { 'ses-1': { courseId: 'jaringan-komputer' } },
  });

  await handlePermitResult(
    {
      permitId: 'p-2',
      change: {
        before: { status: 'pending' },
        after: { status: 'rejected', studentId: 'u8', sessionId: 'ses-1' },
      },
    },
    mocks.deps,
  );

  assert.equal(
    mocks.sentMessages[0].notification.body,
    'Pengajuan izinmu Ditolak untuk jaringan-komputer.',
  );
  assert.equal(mocks.sentMessages[0].data.type, 'permit_result');
});

test('permitResult tidak mengirim bila status sudah direview', async () => {
  const mocks = createDepsMock();

  await handlePermitResult(
    {
      permitId: 'p-3',
      change: {
        before: { status: 'approved' },
        after: { status: 'rejected', studentId: 'u7', sessionId: 'ses-1' },
      },
    },
    mocks.deps,
  );

  assert.deepEqual(mocks.sessionCalls, []);
  assert.deepEqual(mocks.sentMessages, []);
});

test('permitResult mencatat error dan tidak melempar ulang', async () => {
  const mocks = createDepsMock({ failingGetSession: true });

  await assert.doesNotReject(
    handlePermitResult(
      {
        permitId: 'p-4',
        change: {
          before: { status: 'pending' },
          after: { status: 'approved', studentId: 'u6', sessionId: 'ses-1' },
        },
      },
      mocks.deps,
    ),
  );

  assert.equal(mocks.errorMessages.length, 1);
  assert.equal(mocks.errorMessages[0].includes('session boom'), true);
});
