import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNotificationData, isSafeNotificationId } from '../src/payload';

test('menerima ID yang sesuai kontrak notificationRoute', () => {
  assert.equal(isSafeNotificationId('ses-01'), true);
  assert.equal(isSafeNotificationId('a_b-C'), true);
  assert.deepEqual(
    buildNotificationData({ type: 'session_opened', sessionId: ' ses-01 ' }),
    { type: 'session_opened', sessionId: 'ses-01' },
  );
  assert.deepEqual(
    buildNotificationData({ type: 'schedule_changed', scheduleId: 'jadwal_1' }),
    { type: 'schedule_changed', scheduleId: 'jadwal_1' },
  );
  assert.deepEqual(
    buildNotificationData({ type: 'permit_result', permitId: 'izin-1' }),
    { type: 'permit_result', permitId: 'izin-1' },
  );
});

test('menghilangkan ID yang tidak valid', () => {
  assert.equal(isSafeNotificationId('a'.repeat(129)), false);
  assert.equal(isSafeNotificationId('id dengan spasi'), false);
  assert.equal(isSafeNotificationId(123), false);

  assert.deepEqual(
    buildNotificationData({ type: 'session_opened', sessionId: 'a'.repeat(129) }),
    { type: 'session_opened' },
  );
  assert.deepEqual(
    buildNotificationData({ type: 'schedule_changed', scheduleId: 'id dengan spasi' }),
    { type: 'schedule_changed' },
  );
  assert.deepEqual(
    buildNotificationData({ type: 'permit_result', permitId: 42 }),
    { type: 'permit_result' },
  );
});

test('hanya mengirim ID sesuai tipe dan semua nilainya string', () => {
  const data = buildNotificationData({
    type: 'permit_result',
    sessionId: 'ses-01',
    scheduleId: 'jadwal_1',
    permitId: 'izin-1',
  });

  assert.deepEqual(data, { type: 'permit_result', permitId: 'izin-1' });
  assert.equal(Object.values(data).every((value) => typeof value === 'string'), true);
});
