const fs = require('node:fs');
const path = require('node:path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-tandaiu-rules';

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();

const LOG_PATH = process.env.TANDAIU_SMOKE_LOG_PATH || path.join(process.cwd(), 'firebase-debug.log');
const CLASS_RELATED = 'class-related';
const CLASS_OTHER = 'class-other';
const UID_RELATED = 'uid-related';
const UID_OTHER = 'uid-other';
const TOKEN_DOC_RELATED = 'installation-related-0001';
const TOKEN_DOC_OTHER = 'installation-other-00001';
const TOKEN_DOC_INVALID = 'installation-related-invalid1';
const TOKEN_RELATED = 'mock-token-related';
const TOKEN_OTHER = 'mock-token-other';
const TOKEN_INVALID = 'mock-invalid-related-0001';
const SESSION_ID = 'ses-smoke-1';
const PERMIT_ID = `${SESSION_ID}_${UID_RELATED}`;
const REJECT_PERMIT_ID = `${SESSION_ID}_${UID_RELATED}_rejected`;
const SCHEDULE_ID = 'sch-smoke-1';
const COURSE_ID = 'dasar-pemrograman';

function log(label, value) {
  console.log(`[smoke] ${label} ${JSON.stringify(value)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function parseEventLine(line) {
  const clean = stripAnsi(line);
  for (const [prefix, status] of [['FCM_MOCK_ERROR ', 'error'], ['FCM_MOCK ', 'sent']]) {
    const index = clean.indexOf(prefix);
    if (index === -1) continue;
    let raw = clean.slice(index + prefix.length).trim();
    raw = raw.replace(/\\"/g, '"').replace(/"\}$/, '').trim();
    try {
      return { status, ...JSON.parse(raw) };
    } catch {
      return null;
    }
  }
  return null;
}

function readEvents(offset) {
  let chunk;
  try {
    chunk = fs.readFileSync(LOG_PATH).subarray(offset).toString('utf8');
  } catch {
    return [];
  }
  return chunk.split(/\r?\n/).map(parseEventLine).filter(Boolean);
}

function logSize() {
  try {
    return fs.statSync(LOG_PATH).size;
  } catch {
    return 0;
  }
}

async function waitForEvents(offset, predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let events = [];
  while (Date.now() < deadline) {
    await sleep(500);
    events = readEvents(offset);
    if (predicate(events)) break;
  }
  return events;
}

function summarize(scenario, events) {
  const sent = events.filter((event) => event.status === 'sent');
  return {
    scenario,
    messageCount: sent.length,
    recipientTokens: [...new Set(sent.map((event) => event.token))],
    failedTokens: [...new Set(events.filter((event) => event.status === 'error').map((event) => event.token))],
    types: [...new Set(sent.map((event) => event.data && event.data.type).filter(Boolean))],
    bodies: sent.map((event) => (event.notification && event.notification.body) || ''),
  };
}

async function readDoc(collectionName, docId) {
  const snapshot = await db.collection(collectionName).doc(docId).get();
  return snapshot.exists ? snapshot.data() : null;
}

async function resetDocs() {
  await Promise.all([
    db.collection('classes').doc(CLASS_RELATED).delete(),
    db.collection('classes').doc(CLASS_OTHER).delete(),
    db.collection('enrollments').doc(`${CLASS_RELATED}_${UID_RELATED}`).delete(),
    db.collection('enrollments').doc(`${CLASS_OTHER}_${UID_OTHER}`).delete(),
    db.collection('deviceTokens').doc(TOKEN_DOC_RELATED).delete(),
    db.collection('deviceTokens').doc(TOKEN_DOC_OTHER).delete(),
    db.collection('deviceTokens').doc(TOKEN_DOC_INVALID).delete(),
    db.collection('sessions').doc(SESSION_ID).delete(),
    db.collection('schedules').doc(SCHEDULE_ID).delete(),
    db.collection('permits').doc(PERMIT_ID).delete(),
    db.collection('permits').doc(REJECT_PERMIT_ID).delete(),
  ]);
}

async function seed() {
  const now = new Date().toISOString();

  await db.collection('classes').doc(CLASS_RELATED).set({
    courseId: COURSE_ID,
    className: 'Kelas A',
    semester: 1,
    semesterParity: 'ganjil',
    assistantUid: 'assistant-smoke',
    createdAt: now,
  });
  await db.collection('classes').doc(CLASS_OTHER).set({
    courseId: COURSE_ID,
    className: 'Kelas B',
    semester: 1,
    semesterParity: 'ganjil',
    assistantUid: 'assistant-smoke',
    createdAt: now,
  });

  await db.collection('enrollments').doc(`${CLASS_RELATED}_${UID_RELATED}`).set({
    classId: CLASS_RELATED,
    courseId: COURSE_ID,
    praktikanId: UID_RELATED,
    praktikanName: 'Praktikan Terkait',
    studentCode: 'R001',
    semester: 1,
    semesterParity: 'ganjil',
    createdAt: now,
  });
  await db.collection('enrollments').doc(`${CLASS_OTHER}_${UID_OTHER}`).set({
    classId: CLASS_OTHER,
    courseId: COURSE_ID,
    praktikanId: UID_OTHER,
    praktikanName: 'Praktikan Kelas Lain',
    studentCode: 'R002',
    semester: 1,
    semesterParity: 'ganjil',
    createdAt: now,
  });

  await db.collection('deviceTokens').doc(TOKEN_DOC_RELATED).set({
    uid: UID_RELATED,
    token: TOKEN_RELATED,
    platform: 'android',
    updatedAt: now,
  });
  await db.collection('deviceTokens').doc(TOKEN_DOC_OTHER).set({
    uid: UID_OTHER,
    token: TOKEN_OTHER,
    platform: 'android',
    updatedAt: now,
  });
  await db.collection('deviceTokens').doc(TOKEN_DOC_INVALID).set({
    uid: UID_RELATED,
    token: TOKEN_INVALID,
    platform: 'android',
    updatedAt: now,
  });

  await db.collection('sessions').doc(SESSION_ID).set({
    classId: CLASS_RELATED,
    courseId: COURSE_ID,
    practicumName: 'Dasar Pemrograman',
    className: 'Kelas A',
    status: 'terjadwal',
    assistantUid: 'assistant-smoke',
    semesterParity: 'ganjil',
    startsAt: now,
    endsAt: now,
    createdAt: now,
  });

  await db.collection('schedules').doc(SCHEDULE_ID).set({
    classId: CLASS_RELATED,
    courseId: COURSE_ID,
    practicumName: 'Dasar Pemrograman',
    className: 'Kelas A',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
    room: 'Lab A',
    createdAt: now,
  });

  await db.collection('permits').doc(PERMIT_ID).set({
    sessionId: SESSION_ID,
    studentId: UID_RELATED,
    studentName: 'Praktikan Terkait',
    status: 'pending',
    reason: 'Uji emulator notifikasi approved',
    createdAt: now,
  });
  await db.collection('permits').doc(REJECT_PERMIT_ID).set({
    sessionId: SESSION_ID,
    studentId: UID_RELATED,
    studentName: 'Praktikan Terkait',
    status: 'pending',
    reason: 'Uji emulator notifikasi rejected',
    createdAt: now,
  });

  log('seed', {
    logPath: LOG_PATH,
    classes: [CLASS_RELATED, CLASS_OTHER],
    enrollments: [
      { classId: CLASS_RELATED, praktikanId: UID_RELATED },
      { classId: CLASS_OTHER, praktikanId: UID_OTHER },
    ],
    deviceTokens: [
      { uid: UID_RELATED, token: TOKEN_RELATED },
      { uid: UID_OTHER, token: TOKEN_OTHER },
      { uid: UID_RELATED, token: TOKEN_INVALID },
    ],
    session: { id: SESSION_ID, classId: CLASS_RELATED, status: 'terjadwal' },
    schedule: { id: SCHEDULE_ID, classId: CLASS_RELATED, room: 'Lab A' },
    permits: [
      { id: PERMIT_ID, studentId: UID_RELATED, status: 'pending' },
      { id: REJECT_PERMIT_ID, studentId: UID_RELATED, status: 'pending' },
    ],
  });
}

async function main() {
  await resetDocs();
  await seed();

  const checks = [];
  const summaries = [];

  function record(name, ok, detail) {
    checks.push({ nama: name, status: ok ? 'PASS' : 'FAIL', detail });
  }

  const sessionOffset = logSize();
  await db.collection('sessions').doc(SESSION_ID).update({ status: 'dibuka' });
  const sessionEvents = await waitForEvents(
    sessionOffset,
    (events) => events.some((event) => event.status === 'sent' && event.data && event.data.type === 'session_opened'),
  );
  const sessionSummary = summarize('sessionOpened', sessionEvents);
  summaries.push(sessionSummary);
  log('skenario', sessionSummary);

  const approvedOffset = logSize();
  await db.collection('permits').doc(PERMIT_ID).update({ status: 'approved' });
  const approvedEvents = await waitForEvents(
    approvedOffset,
    (events) => events.some((event) => event.status === 'sent' && event.notification && event.notification.body.includes('Disetujui')),
  );
  const approvedSummary = summarize('permitResultApproved', approvedEvents);
  summaries.push(approvedSummary);
  log('skenario', approvedSummary);

  const scheduleOffset = logSize();
  await db.collection('schedules').doc(SCHEDULE_ID).update({ room: 'Lab B' });
  const scheduleEvents = await waitForEvents(
    scheduleOffset,
    (events) => events.some((event) => event.status === 'sent' && event.data && event.data.type === 'schedule_changed'),
  );
  const scheduleSummary = summarize('scheduleChanged', scheduleEvents);
  summaries.push(scheduleSummary);
  log('skenario', scheduleSummary);

  const rejectedOffset = logSize();
  await db.collection('permits').doc(REJECT_PERMIT_ID).update({ status: 'rejected' });
  const rejectedEvents = await waitForEvents(
    rejectedOffset,
    (events) => events.some((event) => event.status === 'sent' && event.notification && event.notification.body.includes('Ditolak')),
  );
  const rejectedSummary = summarize('permitResultRejected', rejectedEvents);
  summaries.push(rejectedSummary);
  log('skenario', rejectedSummary);

  const session = await readDoc('sessions', SESSION_ID);
  const approvedPermit = await readDoc('permits', PERMIT_ID);
  const rejectedPermit = await readDoc('permits', REJECT_PERMIT_ID);
  const schedule = await readDoc('schedules', SCHEDULE_ID);
  const invalidToken = await readDoc('deviceTokens', TOKEN_DOC_INVALID);
  const validToken = await readDoc('deviceTokens', TOKEN_DOC_RELATED);
  const otherToken = await readDoc('deviceTokens', TOKEN_DOC_OTHER);
  const recipientTokens = [...new Set(summaries.flatMap((item) => item.recipientTokens))];
  const allowedTokens = new Set([TOKEN_RELATED]);

  record('hanya token kelas terkait yang menerima', recipientTokens.every((token) => allowedTokens.has(token)), { recipientTokens });
  record('mock-token-other tidak menerima', !recipientTokens.includes(TOKEN_OTHER), { recipientTokens });
  record('sesi tersimpan dibuka', session && session.status === 'dibuka', { status: session && session.status });
  record('izin approved tersimpan', approvedPermit && approvedPermit.status === 'approved', { status: approvedPermit && approvedPermit.status });
  record('izin rejected tersimpan', rejectedPermit && rejectedPermit.status === 'rejected', { status: rejectedPermit && rejectedPermit.status });
  record('jadwal tersimpan Lab B', schedule && schedule.room === 'Lab B', { room: schedule && schedule.room });
  record('scheduleChanged terpicu', scheduleSummary.recipientTokens.length > 0, scheduleSummary);
  record(
    'notifikasi rejected memuat Ditolak',
    rejectedEvents.some((event) => event.status === 'sent' && event.data && event.data.type === 'permit_result' && event.notification && event.notification.body.includes('Ditolak')),
    { bodies: rejectedSummary.bodies },
  );
  record('token invalid dihapus', invalidToken === null, { exists: invalidToken !== null });
  record('token valid uid-related tetap aktif', validToken !== null && validToken.token === TOKEN_RELATED, { token: validToken && validToken.token });
  record('token uid kelas lain tetap aktif', otherToken !== null && otherToken.token === TOKEN_OTHER, { token: otherToken && otherToken.token });
  record(
    'kegagalan token invalid tidak menggagalkan token valid',
    sessionSummary.recipientTokens.includes(TOKEN_RELATED) && sessionSummary.failedTokens.includes(TOKEN_INVALID),
    { recipientTokens: sessionSummary.recipientTokens, failedTokens: sessionSummary.failedTokens },
  );

  log('ringkasanAkhir', { logPath: LOG_PATH, summaries, checks });
  for (const check of checks) log('check', check);

  const failures = checks.filter((check) => check.status === 'FAIL');
  if (failures.length > 0) {
    console.error(`[smoke] RESULT FAIL ${failures.length} dari ${checks.length} pengecekan`);
    process.exitCode = 1;
    return;
  }
  log('RESULT', { status: 'PASS', checks: checks.length });
}

main().catch((error) => {
  console.error('[smoke] gagal', error);
  process.exitCode = 1;
});
