const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-tandaiu-rules';

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();

const CLASS_RELATED = 'class-related';
const CLASS_OTHER = 'class-other';
const UID_RELATED = 'uid-related';
const UID_OTHER = 'uid-other';
const TOKEN_DOC_RELATED = 'installation-related-0001';
const TOKEN_DOC_OTHER = 'installation-other-00001';
const TOKEN_RELATED = 'mock-token-related';
const TOKEN_OTHER = 'mock-token-other';
const SESSION_ID = 'ses-smoke-1';
const PERMIT_ID = `${SESSION_ID}_${UID_RELATED}`;
const COURSE_ID = 'dasar-pemrograman';

function log(label, value) {
  console.log(`[smoke] ${label} ${JSON.stringify(value)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resetDocs() {
  await Promise.all([
    db.collection('classes').doc(CLASS_RELATED).delete(),
    db.collection('classes').doc(CLASS_OTHER).delete(),
    db.collection('enrollments').doc(`${CLASS_RELATED}_${UID_RELATED}`).delete(),
    db.collection('enrollments').doc(`${CLASS_OTHER}_${UID_OTHER}`).delete(),
    db.collection('deviceTokens').doc(TOKEN_DOC_RELATED).delete(),
    db.collection('deviceTokens').doc(TOKEN_DOC_OTHER).delete(),
    db.collection('sessions').doc(SESSION_ID).delete(),
    db.collection('permits').doc(PERMIT_ID).delete(),
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

  await db.collection('permits').doc(PERMIT_ID).set({
    sessionId: SESSION_ID,
    studentId: UID_RELATED,
    studentName: 'Praktikan Terkait',
    status: 'pending',
    reason: 'Uji emulator notifikasi',
    createdAt: now,
  });

  log('seed', {
    projectId: process.env.GCLOUD_PROJECT,
    firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    classes: [CLASS_RELATED, CLASS_OTHER],
    enrollments: [
      { classId: CLASS_RELATED, praktikanId: UID_RELATED },
      { classId: CLASS_OTHER, praktikanId: UID_OTHER },
    ],
    deviceTokens: [
      { uid: UID_RELATED, token: TOKEN_RELATED, kelas: CLASS_RELATED },
      { uid: UID_OTHER, token: TOKEN_OTHER, kelas: CLASS_OTHER },
    ],
    session: { id: SESSION_ID, classId: CLASS_RELATED, status: 'terjadwal' },
    permit: { id: PERMIT_ID, studentId: UID_RELATED, status: 'pending' },
  });
}

async function main() {
  await resetDocs();
  await seed();

  await db.collection('sessions').doc(SESSION_ID).update({ status: 'dibuka' });
  log('update', { collection: 'sessions', id: SESSION_ID, status: 'dibuka' });

  await db.collection('permits').doc(PERMIT_ID).update({ status: 'approved' });
  log('update', { collection: 'permits', id: PERMIT_ID, status: 'approved' });

  log('panitiaDiharapkan', {
    sessionOpened: { token: TOKEN_RELATED, uid: UID_RELATED, kelas: CLASS_RELATED },
    permitResult: { token: TOKEN_RELATED, uid: UID_RELATED, kelas: CLASS_RELATED },
    tidakHadirDiharapkan: { token: TOKEN_OTHER, uid: UID_OTHER, kelas: CLASS_OTHER },
  });

  await sleep(10000);
  log('selesaiMenungguTrigger', { ms: 10000 });
}

main().catch((error) => {
  console.error('[smoke] gagal', error);
  process.exitCode = 1;
});
