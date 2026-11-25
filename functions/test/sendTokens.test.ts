import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFcmMessage,
  isRemovableTokenError,
  sendNotificationToUids,
  type DeviceTokenRecord,
  type DeviceTokenStore,
  type FcmMessage,
  type MessagingSender,
  type NotificationLogger,
  type SendBatchResponse,
} from '../src/sendTokens';

type LogEntry = { level: 'log' | 'error'; message: string };

function createMocks(
  records: readonly DeviceTokenRecord[],
  responder: (messages: readonly FcmMessage[]) => SendBatchResponse,
) {
  const uidChunks: string[][] = [];
  const batches: number[] = [];
  const sentMessages: FcmMessage[] = [];
  const removed: string[] = [];
  const logs: LogEntry[] = [];

  const tokenStore: DeviceTokenStore = {
    async listByUids(uids) {
      uidChunks.push([...uids]);
      return records.filter((record) => uids.includes(record.uid));
    },
    async remove(docId) {
      removed.push(docId);
    },
  };

  const sender: MessagingSender = {
    async sendEach(messages) {
      batches.push(messages.length);
      sentMessages.push(...messages);
      return responder(messages);
    },
  };

  const logger: NotificationLogger = {
    log: (message) => logs.push({ level: 'log', message }),
    error: (message) => logs.push({ level: 'error', message }),
  };

  return { uidChunks, batches, sentMessages, removed, logs, tokenStore, sender, logger };
}

const data = { type: 'session_opened', sessionId: 'ses-01' };

test('buildFcmMessage menyetel channel default dan menyalin data', () => {
  const message = buildFcmMessage({ token: 't1', title: 'Judul', body: 'Isi', data });
  assert.equal(message.token, 't1');
  assert.equal(message.android.notification.channelId, 'default');
  assert.deepEqual(message.notification, { title: 'Judul', body: 'Isi' });
  assert.deepEqual(message.data, data);
});

test('mengirim ke uid unik dengan chunk query maksimal 30', async () => {
  const uids = Array.from({ length: 31 }, (_, index) => `u${index}`);
  const records = uids.map((uid, index) => ({ id: `d${index}`, uid, token: `t${index}` }));
  const mocks = createMocks(records, (messages) => ({
    responses: messages.map(() => ({ success: true })),
  }));

  const summary = await sendNotificationToUids({
    uids: [...uids, 'u0'],
    title: 'Sesi dibuka',
    body: 'Praktikum sudah dibuka.',
    data,
    sender: mocks.sender,
    tokenStore: mocks.tokenStore,
    logger: mocks.logger,
  });

  assert.equal(summary.queriedUids, 31);
  assert.equal(summary.tokenCount, 31);
  assert.equal(summary.sentCount, 31);
  assert.equal(mocks.uidChunks.length, 2);
  assert.equal(mocks.uidChunks[0].length, 30);
  assert.deepEqual(mocks.uidChunks[1], ['u30']);
});

test('memecah pengiriman per 500 pesan', async () => {
  const records = Array.from({ length: 501 }, (_, index) => ({
    id: `d${index}`,
    uid: `u${index}`,
    token: `t${index}`,
  }));
  const mocks = createMocks(records, (messages) => ({
    responses: messages.map(() => ({ success: true })),
  }));

  const summary = await sendNotificationToUids({
    uids: records.map((record) => record.uid),
    title: 'Jadwal berubah',
    body: 'Jadwal diperbarui.',
    data,
    sender: mocks.sender,
    tokenStore: mocks.tokenStore,
    logger: mocks.logger,
  });

  assert.deepEqual(mocks.batches, [500, 1]);
  assert.equal(summary.sentCount, 501);
});

test('menghapus token hanya untuk dua kode error yang ditentukan', async () => {
  const records: DeviceTokenRecord[] = [
    { id: 'bad-unregistered', uid: 'u1', token: 't1' },
    { id: 'bad-invalid', uid: 'u2', token: 't2' },
    { id: 'other-error', uid: 'u3', token: 't3' },
  ];
  const mocks = createMocks(records, () => ({
    responses: [
      { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      { success: false, error: { code: 'messaging/invalid-registration-token' } },
      { success: false, error: { code: 'messaging/server-unavailable' } },
    ],
  }));

  const summary = await sendNotificationToUids({
    uids: ['u1', 'u2', 'u3'],
    title: 'Hasil pengajuan izin',
    body: 'Pengajuan izinmu Disetujui.',
    data,
    sender: mocks.sender,
    tokenStore: mocks.tokenStore,
    logger: mocks.logger,
  });

  assert.equal(isRemovableTokenError({ code: 'messaging/server-unavailable' }), false);
  assert.deepEqual(mocks.removed.slice().sort(), ['bad-invalid', 'bad-unregistered']);
  assert.equal(mocks.logs.some((entry) => entry.level === 'error'), true);
  assert.equal(summary.failureCount, 3);
});

test('error pengiriman yang dilempar dicatat tanpa menghapus token', async () => {
  const records: DeviceTokenRecord[] = [{ id: 'd1', uid: 'u1', token: 't1' }];
  const mocks = createMocks(records, () => {
    throw new Error('boom');
  });

  const summary = await sendNotificationToUids({
    uids: ['u1'],
    title: 'Sesi dibuka',
    body: 'Praktikum sudah dibuka.',
    data,
    sender: mocks.sender,
    tokenStore: mocks.tokenStore,
    logger: mocks.logger,
  });

  assert.deepEqual(mocks.removed, []);
  assert.equal(mocks.logs.some((entry) => entry.level === 'error' && entry.message.includes('boom')), false);
  assert.equal(mocks.logs.some((entry) => entry.level === 'error'), true);
  assert.equal(summary.failureCount, 1);
});
