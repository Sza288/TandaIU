import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCHEDULE_TRIGGER_FIELDS,
  changedScheduleFields,
  collectEnrollmentUids,
  collectPermitRecipientUid,
  collectScheduleRecipientUids,
  describeScheduleChanges,
  getPermitResultStatus,
  isPermitResultChange,
  isScheduleChangedTrigger,
  isSessionOpenedChange,
  type FirestoreData,
} from '../src/recipients';

test('predikat sesi hanya terjadwal ke dibuka', () => {
  assert.equal(isSessionOpenedChange({ before: { status: 'terjadwal' }, after: { status: 'dibuka' } }), true);
  assert.equal(isSessionOpenedChange({ before: { status: 'dibuka' }, after: { status: 'dibuka' } }), false);
  assert.equal(isSessionOpenedChange({ before: { status: 'terjadwal' }, after: { status: 'ditutup' } }), false);
  assert.equal(isSessionOpenedChange({ before: null, after: { status: 'dibuka' } }), false);
});

test('predikat izin hanya pending ke approved atau rejected', () => {
  assert.equal(getPermitResultStatus({ before: { status: 'pending' }, after: { status: 'approved' } }), 'approved');
  assert.equal(getPermitResultStatus({ before: { status: 'pending' }, after: { status: 'rejected' } }), 'rejected');
  assert.equal(getPermitResultStatus({ before: { status: 'approved' }, after: { status: 'rejected' } }), null);
  assert.equal(isPermitResultChange({ before: { status: 'pending' }, after: { status: 'approved' } }), true);
  assert.equal(isPermitResultChange({ before: { status: 'pending' }, after: { status: 'pending' } }), false);
});

test('predikat jadwal hanya memeriksa field yang ditentukan', () => {
  const before: FirestoreData = {
    classId: 'c1',
    courseId: 'k1',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
    room: 'Lab A',
  };

  assert.deepEqual(changedScheduleFields({ before, after: { ...before } }), []);
  assert.equal(isScheduleChangedTrigger({ before, after: { ...before } }), false);
  assert.equal(isScheduleChangedTrigger({ before, after: { ...before, assistantUid: 'asisten-1' } }), false);

  for (const field of SCHEDULE_TRIGGER_FIELDS) {
    const after = { ...before, [field]: field === 'dayOfWeek' ? 2 : 'berubah' };
    assert.deepEqual(changedScheduleFields({ before, after }), [field]);
    assert.equal(isScheduleChangedTrigger({ before, after }), true);
  }

  assert.deepEqual(describeScheduleChanges(['classId', 'room']), ['Kelas berubah', 'Ruangan berubah']);
});

test('enrollment per classId menghasilkan uid unik', () => {
  const enrollments: FirestoreData[] = [
    { classId: 'c1', praktikanId: 'u1' },
    { classId: 'c1', praktikanId: 'u1' },
    { classId: 'c1', praktikanId: 'u2' },
    { classId: 'c2', praktikanId: 'u3' },
    { classId: 'c1', praktikanId: '  ' },
  ];

  assert.deepEqual(collectEnrollmentUids(enrollments, 'c1'), ['u1', 'u2']);
  assert.deepEqual(collectEnrollmentUids(enrollments, '  '), []);
});

test('perubahan classId jadwal menggabungkan kelas lama dan baru', () => {
  const enrollments: FirestoreData[] = [
    { classId: 'c1', praktikanId: 'u1' },
    { classId: 'c1', praktikanId: 'u2' },
    { classId: 'c2', praktikanId: 'u3' },
  ];

  assert.deepEqual(
    collectScheduleRecipientUids(enrollments, { classId: 'c2' }, { classId: 'c1' }),
    ['u3', 'u1', 'u2'],
  );
  assert.deepEqual(
    collectScheduleRecipientUids(enrollments, { classId: 'c1' }, { classId: 'c1' }),
    ['u1', 'u2'],
  );
});

test('penerima izin hanya studentId', () => {
  assert.equal(collectPermitRecipientUid({ studentId: 'u9', praktikanId: 'u1' }), 'u9');
  assert.equal(collectPermitRecipientUid({ studentId: '  ' }), null);
  assert.equal(collectPermitRecipientUid({ studentId: 123 }), null);
});
