import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import type { Message, Messaging } from 'firebase-admin/messaging';
import { MOCK_INVALID_TOKEN_PREFIX, createAdminDeps } from '../src/admin';
import { buildFcmMessage, type NotificationLogger } from '../src/sendTokens';

function createEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.TANDAIU_EMULATOR_MOCK_FCM;
  delete env.FUNCTIONS_EMULATOR;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

function createLogger() {
  const logs: string[] = [];
  const logger: NotificationLogger = {
    log: (message) => logs.push(message),
    error: (message) => logs.push(`ERROR ${message}`),
  };
  return { logger, logs };
}

function createMessagingMock() {
  const calls: Array<{ messages: readonly Message[]; dryRun?: boolean }> = [];
  const messaging = {
    async sendEach(messages: readonly Message[], dryRun?: boolean) {
      calls.push({ messages, dryRun });
      return { responses: messages.map(() => ({ success: true })) };
    },
  } as unknown as Messaging;
  return { messaging, calls };
}

const message = buildFcmMessage({
  token: 'mock-token-a',
  title: 'Sesi dibuka',
  body: 'Praktikum sudah dibuka.',
  data: { type: 'session_opened', sessionId: 'ses-1' },
});

test('mock aktif saat FUNCTIONS_EMULATOR dan sakelar keduanya benar', async () => {
  const { logger, logs } = createLogger();
  const { messaging, calls } = createMessagingMock();
  const deps = createAdminDeps(logger, {
    env: createEnv({ TANDAIU_EMULATOR_MOCK_FCM: '1', FUNCTIONS_EMULATOR: 'true' }),
    firestore: {} as Firestore,
    messaging,
  });

  const result = await deps.sender.sendEach([message]);

  assert.deepEqual(result.responses.map((item) => item.success), [true]);
  assert.equal(calls.length, 0);
  assert.equal(logs.some((entry) => entry.startsWith('FCM_MOCK ')), true);
  assert.equal(logs.some((entry) => entry.includes('PERINGATAN')), false);
});

test('sakelar tanpa emulator memakai FCM asli dan mencatat satu peringatan', async () => {
  const { logger, logs } = createLogger();
  const { messaging, calls } = createMessagingMock();
  const deps = createAdminDeps(logger, {
    env: createEnv({ TANDAIU_EMULATOR_MOCK_FCM: '1', FUNCTIONS_EMULATOR: 'false' }),
    firestore: {} as Firestore,
    messaging,
  });

  await deps.sender.sendEach([message]);

  assert.equal(calls.length, 1);
  assert.equal(logs.filter((entry) => entry.includes('PERINGATAN')).length, 1);
  assert.equal(logs.some((entry) => entry.startsWith('FCM_MOCK ')), false);
});

test('tanpa sakelar memakai FCM asli walau di emulator', async () => {
  const { logger, logs } = createLogger();
  const { messaging, calls } = createMessagingMock();
  const deps = createAdminDeps(logger, {
    env: createEnv({ FUNCTIONS_EMULATOR: 'true' }),
    firestore: {} as Firestore,
    messaging,
  });

  await deps.sender.sendEach([message]);

  assert.equal(calls.length, 1);
  assert.equal(logs.some((entry) => entry.includes('PERINGATAN')), false);
  assert.equal(logs.some((entry) => entry.startsWith('FCM_MOCK ')), false);
});

test('mock mengembalikan error token invalid yang masuk kategori removable', async () => {
  const { logger, logs } = createLogger();
  const { messaging, calls } = createMessagingMock();
  const deps = createAdminDeps(logger, {
    env: createEnv({ TANDAIU_EMULATOR_MOCK_FCM: '1', FUNCTIONS_EMULATOR: 'true' }),
    firestore: {} as Firestore,
    messaging,
  });
  const invalidMessage = buildFcmMessage({
    token: `${MOCK_INVALID_TOKEN_PREFIX}u1`,
    title: 'Sesi dibuka',
    body: 'Praktikum sudah dibuka.',
    data: { type: 'session_opened', sessionId: 'ses-1' },
  });

  const result = await deps.sender.sendEach([invalidMessage, message]);

  assert.deepEqual(result.responses.map((item) => item.success), [false, true]);
  assert.equal(
    (result.responses[0].error as { code?: string }).code,
    'messaging/registration-token-not-registered',
  );
  assert.equal(calls.length, 0);
  assert.equal(logs.some((entry) => entry.startsWith('FCM_MOCK_ERROR ')), true);
  assert.equal(logs.some((entry) => entry.startsWith('FCM_MOCK ')), true);
});
