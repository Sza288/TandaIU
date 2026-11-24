const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, test } = require('node:test');

const PROJECT_ID = 'demo-tandaiu-rules';
const AUTH_HOST = '127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1:8080';
const FUNCTIONS_HOST = '127.0.0.1:5001';
const PASSWORD = `Local-${randomUUID()}-A1!`;

if (process.env.GCLOUD_PROJECT !== PROJECT_ID
  || process.env.FIREBASE_AUTH_EMULATOR_HOST !== AUTH_HOST
  || process.env.FIRESTORE_EMULATOR_HOST !== FIRESTORE_HOST
  || process.env.FUNCTIONS_EMULATOR_HOST !== FUNCTIONS_HOST) {
  throw new Error('Tests require explicit local demo project and loopback Emulator endpoints.');
}

const { initializeApp, deleteApp } = require('firebase/app');
const {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} = require('firebase/auth');
const {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} = require('firebase/firestore');
const {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} = require('firebase/functions');
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } =
  require('firebase-admin/app');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  apiKey: 'emulator-only-api-key',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
}, `attendance-test-${randomUUID()}`);
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const firestore = getFirestore(app);
connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
const functions = getFunctions(app, 'us-central1');
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

const adminApp = initializeAdminApp({ projectId: PROJECT_ID }, `attendance-admin-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminFirestore = getAdminFirestore(adminApp);
let sequence = 0;
const labs = {
  lat: 0,
  lon: 0,
  radius: 100,
  name: 'Local lab',
  lantai: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}-${randomUUID().slice(0, 8)}`;
}

async function createAccount(role = 'praktikan', assistantUid = '') {
  if (auth.currentUser) await signOut(auth);
  const suffix = randomUUID();
  const email = `${role}-${suffix}@example.test`;
  const credential = await createUserWithEmailAndPassword(auth, email, PASSWORD);
  const { uid } = credential.user;
  await adminFirestore.doc(`users/${uid}`).set({
    uid,
    role,
    name: `Test ${role}`,
    email,
  });
  if (role === 'asisten') {
    await adminAuth.setCustomUserClaims(uid, { assistantSemesterParity: 'ganjil' });
    await credential.user.getIdToken(true);
  }
  return { uid, email };
}

async function createClass(assistantUid) {
  const classId = nextId('class');
  await adminFirestore.doc('courseCatalog/test-course').set({
    name: 'Test course',
    semester: 3,
    semesterParity: 'ganjil',
  });
  await adminFirestore.doc(`classes/${classId}`).set({
    courseId: 'test-course',
    className: 'A3',
    createdAt: new Date().toISOString(),
    semester: 3,
    semesterParity: 'ganjil',
    assistantUid,
  });
  return classId;
}

async function createFixture({
  role = 'praktikan',
  sessionStatus = 'dibuka',
  laboratoryId = 'test-laboratory',
  laboratory = labs,
  startsAt = new Date(Date.now() - 60 * 60 * 1000),
  endsAt = new Date(Date.now() + 60 * 60 * 1000),
} = {}) {
  const user = await createAccount(role);
  const assistantUid = nextId('assistant-owner');
  const classId = await createClass(assistantUid);
  const sessionId = nextId('session');
  const laboratoryDocId = laboratoryId || nextId('no-laboratory');

  if (laboratoryId && laboratory !== null) {
    await adminFirestore.doc(`laboratories/${laboratoryDocId}`).set(laboratory);
  }
  await adminFirestore.doc(`enrollments/${classId}_${user.uid}`).set({
    praktikanId: user.uid,
    classId,
    courseId: 'test-course',
  });
  await adminFirestore.doc(`sessions/${sessionId}`).set({
    classId,
    courseId: 'test-course',
    className: 'A3',
    semester: 3,
    semesterParity: 'ganjil',
    assistantUid,
    practicumName: 'Test practicum',
    status: sessionStatus,
    startsAt,
    endsAt,
    ...(laboratoryId ? { laboratoryId } : {}),
  });
  return { ...user, classId, sessionId, laboratoryId: laboratoryId ? laboratoryDocId : '' };
}

function submit(data) {
  return httpsCallable(functions, 'submitAttendance')(data);
}

function cancel(data) {
  return httpsCallable(functions, 'cancelAttendance')(data);
}

function issueQr(sessionId) {
  return httpsCallable(functions, 'issueAttendanceQr')({ sessionId });
}

function revokeQr(sessionId) {
  return httpsCallable(functions, 'revokeAttendanceQr')({ sessionId });
}

function validateQr(sessionId, qrPayload) {
  return httpsCallable(functions, 'validateAttendanceQr')({ sessionId, qrPayload });
}

function submitQr(sessionId, qrPayload, overrides = {}) {
  return httpsCallable(functions, 'submitQrAttendance')({
    sessionId,
    qrPayload,
    latitude: 0,
    longitude: 0,
    accuracyMeters: 10,
    uid: 'forged-payload-uid',
    role: 'asisten',
    laboratoryId: 'forged-laboratory',
    radiusMeters: 10_000,
    status: 'ditutup',
    startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
}

function closeSession(sessionId) {
  return httpsCallable(functions, 'closeSession')({ sessionId });
}

async function assignAssistantOwner(fixture) {
  const assistant = await createAccount('asisten');
  await adminFirestore.doc(`sessions/${fixture.sessionId}`).update({
    assistantUid: assistant.uid,
  });
  await adminFirestore.doc(`classes/${fixture.classId}`).update({
    assistantUid: assistant.uid,
  });
  return assistant;
}

async function expectCallableError(operation, code, reasonCode) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, `functions/${code}`);
    if (reasonCode) assert.equal(error.details?.reasonCode, reasonCode);
    return true;
  });
}

function request(sessionId, overrides = {}) {
  return {
    sessionId,
    latitude: 0,
    longitude: 0,
    accuracyMeters: 10,
    ...overrides,
  };
}

function jakartaIso(milliseconds) {
  const localDate = new Date(milliseconds + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, -1);
  return `${localDate}+07:00`;
}

before(async () => {
  const response = await fetch(`http://${FIRESTORE_HOST}/`);
  assert.equal(response.status, 200);
});

test('cancelled session is rejected as closed', async () => {
  const fixture = await createFixture({ sessionStatus: 'dibatalkan' });
  await expectCallableError(
    submit(request(fixture.sessionId)),
    'failed-precondition',
    'SESSION_CLOSED',
  );
});

after(async () => {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
  await deleteAdminApp(adminApp);
});

test('authenticated enrolled practikan succeeds inside laboratory radius', async () => {
  const fixture = await createFixture();
  const result = await submit(request(fixture.sessionId, { longitude: 0.0005 }));
  assert.equal(result.data.ok, true);
  assert.ok(result.data.distanceMeters <= result.data.radiusMeters);
  const attendance = await getDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${fixture.uid}`));
  assert.equal(attendance.data().praktikanId, fixture.uid);
  assert.equal(attendance.data().status, 'hadir');
  assert.equal(attendance.data().laboratoryId, fixture.laboratoryId);
  assert.equal(attendance.data().laboratoryName, labs.name);
  assert.equal(attendance.data().radiusMeters, labs.radius);
});

test('location exactly at the configured radius boundary succeeds', async () => {
  const fixture = await createFixture();
  const radiusMeters = 100;
  const edgeLongitude = 2 * Math.asin(radiusMeters / (2 * 6_371_000)) * (180 / Math.PI);
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat = 0;
  const lon = radians(edgeLongitude);
  const distance = 2 * 6_371_000 * Math.asin(Math.sqrt(
    Math.cos(lat) ** 2 * Math.sin(lon / 2) ** 2,
  ));
  await adminFirestore.doc(`laboratories/${fixture.laboratoryId}`).update({ radius: distance });
  const result = await submit(request(fixture.sessionId, { longitude: edgeLongitude }));
  assert.equal(result.data.ok, true);
  assert.ok(result.data.distanceMeters <= result.data.radiusMeters);
});

test('laboratory minimum and maximum radius values are accepted', async () => {
  for (const radius of [1, 500]) {
    const fixture = await createFixture({
      laboratory: { ...labs, radius },
    });
    const result = await submit(request(fixture.sessionId));
    assert.equal(result.data.radiusMeters, radius);
  }
});

test('location outside laboratory radius is rejected without attendance record', async () => {
  const fixture = await createFixture();
  await expectCallableError(
    submit(request(fixture.sessionId, {
      longitude: 0.002,
      laboratory: { latitude: 0, longitude: 0, radiusMeters: 10_000 },
      laboratoryLatitude: 0,
      laboratoryLongitude: 0,
      radiusMeters: 10_000,
    })),
    'failed-precondition',
  );
  assert.equal((await getDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${fixture.uid}`))).exists(), false);
});

test('accuracy of exactly 50 meters is accepted', async () => {
  const fixture = await createFixture();
  const result = await submit(request(fixture.sessionId, { accuracyMeters: 50 }));
  assert.equal(result.data.ok, true);
});

test('accuracy worse than 50 meters is rejected', async () => {
  const fixture = await createFixture();
  await expectCallableError(
    submit(request(fixture.sessionId, { accuracyMeters: 50.01 })),
    'failed-precondition',
  );
});

test('closed session is rejected', async () => {
  const fixture = await createFixture({ sessionStatus: 'ditutup' });
  await expectCallableError(
    submit(request(fixture.sessionId)),
    'failed-precondition',
    'SESSION_CLOSED',
  );
});

test('scheduled session is rejected even when its time range is current', async () => {
  const fixture = await createFixture({ sessionStatus: 'terjadwal' });
  await expectCallableError(
    submit(request(fixture.sessionId)),
    'failed-precondition',
    'SESSION_NOT_OPEN',
  );
});

test('open session before startsAt is rejected with a domain reason', async () => {
  const fixture = await createFixture({
    startsAt: new Date(Date.now() + 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });
  await expectCallableError(
    submit(request(fixture.sessionId)),
    'failed-precondition',
    'SESSION_NOT_STARTED',
  );
});

test('open session at or after endsAt is rejected with a domain reason', async () => {
  const fixture = await createFixture({
    startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endsAt: new Date(Date.now() - 60 * 60 * 1000),
  });
  await expectCallableError(
    submit(request(fixture.sessionId)),
    'failed-precondition',
    'SESSION_ENDED',
  );
});

test('Firestore session timestamps with a WIB offset are compared as absolute instants', async () => {
  const now = Date.now();
  const fixture = await createFixture({
    startsAt: jakartaIso(now - 60 * 1000),
    endsAt: jakartaIso(now + 60 * 1000),
  });
  const result = await submit(request(fixture.sessionId, {
    status: 'ditutup',
    startsAt: jakartaIso(now + 60 * 60 * 1000),
    endsAt: jakartaIso(now - 60 * 60 * 1000),
  }));
  assert.equal(result.data.ok, true);
});

test('missing or invalid Firestore session timestamps are rejected explicitly', async () => {
  const missingStart = await createFixture({ startsAt: null });
  await expectCallableError(
    submit(request(missingStart.sessionId)),
    'failed-precondition',
    'SESSION_TIME_INVALID',
  );

  const invalidRange = await createFixture({
    startsAt: new Date(Date.now() + 60 * 60 * 1000),
    endsAt: new Date(Date.now() - 60 * 60 * 1000),
  });
  await expectCallableError(
    submit(request(invalidRange.sessionId)),
    'failed-precondition',
    'SESSION_TIME_INVALID',
  );
});

test('session without laboratoryId is rejected', async () => {
  const fixture = await createFixture({ laboratoryId: '' });
  await expectCallableError(submit(request(fixture.sessionId)), 'failed-precondition');
});

test('missing laboratory and invalid laboratory coordinates are rejected', async () => {
  const missing = await createFixture({ laboratoryId: 'missing-laboratory', laboratory: null });
  await expectCallableError(submit(request(missing.sessionId)), 'not-found');

  const invalid = await createFixture({
    laboratory: { ...labs, lat: 91 },
  });
  await expectCallableError(submit(request(invalid.sessionId)), 'failed-precondition');

  const invalidRadius = await createFixture({
    laboratory: { ...labs, radius: '100' },
  });
  await expectCallableError(submit(request(invalidRadius.sessionId)), 'failed-precondition');

  const radiusBelowContractMinimum = await createFixture({
    laboratory: { ...labs, radius: 0.5 },
  });
  await expectCallableError(
    submit(request(radiusBelowContractMinimum.sessionId)),
    'failed-precondition',
  );

  const radiusAboveContractMaximum = await createFixture({
    laboratory: { ...labs, radius: 501 },
  });
  await expectCallableError(
    submit(request(radiusAboveContractMaximum.sessionId)),
    'failed-precondition',
  );
});

test('assistant cannot submit attendance and client UID fields are ignored', async () => {
  const assistantFixture = await createFixture({ role: 'asisten' });
  await expectCallableError(submit(request(assistantFixture.sessionId)), 'permission-denied');

  const praktikan = await createFixture();
  const payload = request(praktikan.sessionId, {
    uid: 'another-user',
    praktikanId: 'another-user',
  });
  await submit(payload);
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${praktikan.sessionId}_${praktikan.uid}`)))
      .data().praktikanId,
    praktikan.uid,
  );
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${praktikan.sessionId}_another-user`))).exists(),
    false,
  );
});

test('unauthenticated callable request is rejected', async () => {
  const fixture = await createFixture();
  await signOut(auth);
  await expectCallableError(submit(request(fixture.sessionId)), 'unauthenticated');
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
});

test('duplicate and concurrent check-ins produce one successful attendance', async () => {
  const fixture = await createFixture();
  const concurrent = await Promise.allSettled([
    submit(request(fixture.sessionId)),
    submit(request(fixture.sessionId)),
  ]);
  assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter((result) => result.status === 'rejected').length, 1);
  await expectCallableError(submit(request(fixture.sessionId)), 'already-exists');
  const records = await getDocs(query(
    collection(firestore, 'attendances'),
    where('sessionId', '==', fixture.sessionId),
    where('praktikanId', '==', fixture.uid),
  ));
  assert.equal(records.size, 1);
});

test('Firestore Rules deny direct client attendance writes', async () => {
  const fixture = await createFixture();
  await assert.rejects(
    setDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${fixture.uid}`), {
      sessionId: fixture.sessionId,
      praktikanId: fixture.uid,
      praktikanName: 'Forged attendance',
      attendedAt: new Date(),
      status: 'hadir',
    }),
    { code: 'permission-denied' },
  );
});

test('authorized assistant cancels attendance; unauthorized assistant cannot', async () => {
  const fixture = await createFixture();
  await submit(request(fixture.sessionId));
  const attendanceId = `${fixture.sessionId}_${fixture.uid}`;
  const originalAttendance = (await getDoc(doc(firestore, 'attendances', attendanceId))).data();

  const unauthorized = await createAccount('asisten');
  await expectCallableError(
    cancel({ sessionId: fixture.sessionId, attendanceId, reason: 'review' }),
    'permission-denied',
  );
  await signOut(auth);

  const ownerEmail = `owner-${randomUUID()}@example.test`;
  const ownerCredential = await createUserWithEmailAndPassword(auth, ownerEmail, PASSWORD);
  const ownerUid = ownerCredential.user.uid;
  await adminFirestore.doc(`users/${ownerUid}`).set({
    uid: ownerUid,
    role: 'asisten',
    name: 'Session owner',
    email: ownerEmail,
  });
  await adminFirestore.doc(`sessions/${fixture.sessionId}`).update({ assistantUid: ownerUid });
  await adminFirestore.doc(`classes/${fixture.classId}`).update({ assistantUid: ownerUid });
  await adminAuth.setCustomUserClaims(ownerUid, { assistantSemesterParity: 'ganjil' });
  await ownerCredential.user.getIdToken(true);
  assert.notEqual(ownerUid, unauthorized.uid);

  await expectCallableError(cancel(null), 'invalid-argument');
  await expectCallableError(
    cancel({ sessionId: `${fixture.sessionId}/invalid`, attendanceId, reason: 'review' }),
    'invalid-argument',
  );
  await expectCallableError(
    cancel({ sessionId: fixture.sessionId, attendanceId: `${attendanceId}/invalid` }),
    'invalid-argument',
  );
  await expectCallableError(
    cancel({ sessionId: fixture.sessionId, attendanceId, reason: 'x'.repeat(301) }),
    'invalid-argument',
  );
  await adminFirestore.doc(`attendances/${attendanceId}`).update({ status: 'izin' });
  await expectCallableError(
    cancel({ sessionId: fixture.sessionId, attendanceId, reason: 'Tidak sesuai lokasi' }),
    'failed-precondition',
  );
  assert.equal((await getDoc(doc(firestore, 'attendances', attendanceId))).data().status, 'izin');
  await adminFirestore.doc(`attendances/${attendanceId}`).update({ status: 'hadir' });

  await cancel({ sessionId: fixture.sessionId, attendanceId, reason: 'Tidak sesuai lokasi' });
  const attendance = (await getDoc(doc(firestore, 'attendances', attendanceId))).data();
  assert.equal(attendance.status, 'dibatalkan');
  assert.equal(attendance.latitude, originalAttendance.latitude);
  assert.equal(attendance.longitude, originalAttendance.longitude);
  assert.equal(attendance.distanceMeters, originalAttendance.distanceMeters);
  assert.equal(attendance.accuracyMeters, originalAttendance.accuracyMeters);
  assert.equal(attendance.laboratoryName, originalAttendance.laboratoryName);
  assert.ok(attendance.cancelledAt?.toDate() instanceof Date);
  assert.equal(attendance.cancelledBy, ownerUid);
  assert.equal(attendance.cancelReason, 'Tidak sesuai lokasi');
  const successful = await getDocs(query(
    collection(firestore, 'attendances'),
    where('sessionId', '==', fixture.sessionId),
    where('status', '==', 'hadir'),
  ));
  assert.equal(successful.size, 0);

  await signOut(auth);
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
  await expectCallableError(submit(request(fixture.sessionId)), 'already-exists');
});

test('authorized session assistant issues a random short-lived QR token stored only as a hash', async () => {
  const fixture = await createFixture();
  await assignAssistantOwner(fixture);
  const result = await issueQr(fixture.sessionId);
  assert.equal(result.data.ok, true);
  assert.match(result.data.qrPayload, /^TANDAIU-ATTENDANCE:1:[A-Za-z0-9_-]{43}$/);
  assert.ok(Date.parse(result.data.expiresAt) > Date.now());
  const tokenDocument = (await adminFirestore
    .doc(`attendanceQrTokens/${fixture.sessionId}`).get()).data();
  assert.equal(tokenDocument.sessionId, fixture.sessionId);
  assert.equal(tokenDocument.issuedBy, auth.currentUser.uid);
  assert.equal(tokenDocument.tokenHash.length, 64);
  assert.equal(JSON.stringify(tokenDocument).includes(result.data.qrPayload), false);
});

test('assistant who does not own the session cannot issue or revoke its QR', async () => {
  const fixture = await createFixture();
  await createAccount('asisten');
  await expectCallableError(issueQr(fixture.sessionId), 'permission-denied');
  await expectCallableError(revokeQr(fixture.sessionId), 'permission-denied');
});

test('one valid QR can be used by multiple enrolled praktikan and stores QR method', async () => {
  const fixture = await createFixture();
  await assignAssistantOwner(fixture);
  const qr = await issueQr(fixture.sessionId);
  const qrPayload = qr.data.qrPayload;

  await signOut(auth);
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
  const first = await submitQr(fixture.sessionId, qrPayload);
  assert.equal(first.data.ok, true);
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${fixture.uid}`)))
      .data().attendanceMethod,
    'qr',
  );
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${fixture.uid}`)))
      .data().praktikanId,
    fixture.uid,
  );

  const secondStudent = await createAccount('praktikan');
  await adminFirestore.doc(`enrollments/${fixture.classId}_${secondStudent.uid}`).set({
    praktikanId: secondStudent.uid,
    classId: fixture.classId,
  });
  const second = await submitQr(fixture.sessionId, qrPayload);
  assert.equal(second.data.ok, true);
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${secondStudent.uid}`)))
      .data().attendanceMethod,
    'qr',
  );
});

test('QR validation and final QR submission enforce the Firestore session time window', async () => {
  const fixture = await createFixture({
    startsAt: new Date(Date.now() + 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });
  await assignAssistantOwner(fixture);
  const qr = await issueQr(fixture.sessionId);

  await signOut(auth);
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
  await expectCallableError(
    validateQr(fixture.sessionId, qr.data.qrPayload),
    'failed-precondition',
    'SESSION_NOT_STARTED',
  );

  await adminFirestore.doc(`sessions/${fixture.sessionId}`).update({
    startsAt: new Date(Date.now() - 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  assert.equal((await validateQr(fixture.sessionId, qr.data.qrPayload)).data.ok, true);

  await adminFirestore.doc(`sessions/${fixture.sessionId}`).update({
    endsAt: new Date(Date.now() - 1000),
  });
  await expectCallableError(
    submitQr(fixture.sessionId, qr.data.qrPayload),
    'failed-precondition',
    'SESSION_ENDED',
  );
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${fixture.uid}`)))
      .exists(),
    false,
  );
});

test('expired, revoked, wrong-session, and closed-session QR tokens are rejected', async () => {
  const expiredFixture = await createFixture();
  const expiredOwner = await assignAssistantOwner(expiredFixture);
  const expiredQr = await issueQr(expiredFixture.sessionId);
  await adminFirestore.doc(`attendanceQrTokens/${expiredFixture.sessionId}`).update({
    expiresAt: new Date(Date.now() - 1000),
  });
  await signOut(auth);
  await signInWithEmailAndPassword(auth, expiredFixture.email, PASSWORD);
  await expectCallableError(
    validateQr(expiredFixture.sessionId, expiredQr.data.qrPayload),
    'deadline-exceeded',
  );
  assert.ok(expiredOwner.uid);

  const revokedFixture = await createFixture();
  const revokedOwner = await assignAssistantOwner(revokedFixture);
  const revokedQr = await issueQr(revokedFixture.sessionId);
  await revokeQr(revokedFixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, revokedFixture.email, PASSWORD);
  await expectCallableError(
    validateQr(revokedFixture.sessionId, revokedQr.data.qrPayload),
    'failed-precondition',
  );
  assert.ok(revokedOwner.uid);

  const firstFixture = await createFixture();
  await assignAssistantOwner(firstFixture);
  const firstQr = await issueQr(firstFixture.sessionId);
  const otherFixture = await createFixture();
  await expectCallableError(
    validateQr(otherFixture.sessionId, firstQr.data.qrPayload),
    'invalid-argument',
  );

  const closedFixture = await createFixture();
  await assignAssistantOwner(closedFixture);
  const closedQr = await issueQr(closedFixture.sessionId);
  await closeSession(closedFixture.sessionId);
  await expectCallableError(issueQr(closedFixture.sessionId), 'failed-precondition');
  const closedToken = (await adminFirestore
    .doc(`attendanceQrTokens/${closedFixture.sessionId}`).get()).data();
  assert.ok(closedToken.revokedAt);
  await adminFirestore.doc(`sessions/${closedFixture.sessionId}`).update({ status: 'dibuka' });
  await signOut(auth);
  await signInWithEmailAndPassword(auth, closedFixture.email, PASSWORD);
  await expectCallableError(
    validateQr(closedFixture.sessionId, closedQr.data.qrPayload),
    'failed-precondition',
  );
});

test('rotating QR invalidates the old token and permits the latest token', async () => {
  const fixture = await createFixture();
  await assignAssistantOwner(fixture);
  const firstQr = await issueQr(fixture.sessionId);
  const secondQr = await issueQr(fixture.sessionId);
  assert.notEqual(firstQr.data.qrPayload, secondQr.data.qrPayload);

  await signOut(auth);
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
  await expectCallableError(
    validateQr(fixture.sessionId, firstQr.data.qrPayload),
    'invalid-argument',
  );
  assert.equal((await validateQr(fixture.sessionId, secondQr.data.qrPayload)).data.ok, true);
  assert.equal((await submitQr(fixture.sessionId, secondQr.data.qrPayload)).data.ok, true);
});

test('QR expiry, revocation, and session closure are rechecked after initial validation', async () => {
  const expiredFixture = await createFixture();
  await assignAssistantOwner(expiredFixture);
  const expiredQr = await issueQr(expiredFixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, expiredFixture.email, PASSWORD);
  assert.equal((await validateQr(expiredFixture.sessionId, expiredQr.data.qrPayload)).data.ok, true);
  await adminFirestore.doc(`attendanceQrTokens/${expiredFixture.sessionId}`).update({
    expiresAt: new Date(Date.now() - 1000),
  });
  await expectCallableError(
    submitQr(expiredFixture.sessionId, expiredQr.data.qrPayload),
    'deadline-exceeded',
  );
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${expiredFixture.sessionId}_${expiredFixture.uid}`)))
      .exists(),
    false,
  );

  const revokedFixture = await createFixture();
  const revokedOwner = await assignAssistantOwner(revokedFixture);
  const revokedQr = await issueQr(revokedFixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, revokedFixture.email, PASSWORD);
  assert.equal((await validateQr(revokedFixture.sessionId, revokedQr.data.qrPayload)).data.ok, true);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, revokedOwner.email, PASSWORD);
  await revokeQr(revokedFixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, revokedFixture.email, PASSWORD);
  await expectCallableError(
    submitQr(revokedFixture.sessionId, revokedQr.data.qrPayload),
    'failed-precondition',
  );

  const closedFixture = await createFixture();
  const closedOwner = await assignAssistantOwner(closedFixture);
  const closedQr = await issueQr(closedFixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, closedFixture.email, PASSWORD);
  assert.equal((await validateQr(closedFixture.sessionId, closedQr.data.qrPayload)).data.ok, true);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, closedOwner.email, PASSWORD);
  await closeSession(closedFixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, closedFixture.email, PASSWORD);
  await expectCallableError(
    submitQr(closedFixture.sessionId, closedQr.data.qrPayload),
    'failed-precondition',
  );
});

test('QR attendance enforces role, enrollment, UID identity, radius, accuracy, and duplicates', async () => {
  const fixture = await createFixture();
  await assignAssistantOwner(fixture);
  const qr = await issueQr(fixture.sessionId);

  await expectCallableError(
    validateQr(fixture.sessionId, qr.data.qrPayload),
    'permission-denied',
  );
  await signOut(auth);
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
  await expectCallableError(
    submitQr(fixture.sessionId, qr.data.qrPayload, { longitude: 0.002 }),
    'failed-precondition',
  );
  await expectCallableError(
    submitQr(fixture.sessionId, qr.data.qrPayload, { accuracyMeters: 50.01 }),
    'failed-precondition',
  );

  const unEnrolled = await createAccount('praktikan');
  await expectCallableError(
    validateQr(fixture.sessionId, qr.data.qrPayload),
    'failed-precondition',
  );
  await adminFirestore.doc(`enrollments/${fixture.classId}_${unEnrolled.uid}`).set({
    praktikanId: unEnrolled.uid,
    classId: fixture.classId,
  });

  const enrolled = await createAccount('praktikan');
  await adminFirestore.doc(`enrollments/${fixture.classId}_${enrolled.uid}`).set({
    praktikanId: enrolled.uid,
    classId: fixture.classId,
  });
  const enrolledSubmission = await submitQr(fixture.sessionId, qr.data.qrPayload);
  assert.equal(enrolledSubmission.data.ok, true);
  assert.equal(
    (await getDoc(doc(firestore, 'attendances', `${fixture.sessionId}_${enrolled.uid}`)))
      .data().praktikanId,
    enrolled.uid,
  );
  await expectCallableError(
    submitQr(fixture.sessionId, qr.data.qrPayload),
    'already-exists',
  );
});

test('concurrent QR check-ins create only one attendance document', async () => {
  const fixture = await createFixture();
  await assignAssistantOwner(fixture);
  const qr = await issueQr(fixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
  const attempts = await Promise.allSettled([
    submitQr(fixture.sessionId, qr.data.qrPayload),
    submitQr(fixture.sessionId, qr.data.qrPayload),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
  const records = await getDocs(query(
    collection(firestore, 'attendances'),
    where('sessionId', '==', fixture.sessionId),
    where('praktikanId', '==', fixture.uid),
  ));
  assert.equal(records.size, 1);
});

test('Firestore Rules deny client reads and writes to QR token documents', async () => {
  const fixture = await createFixture();
  await assert.rejects(
    getDoc(doc(firestore, 'attendanceQrTokens', fixture.sessionId)),
    { code: 'permission-denied' },
  );
  await assert.rejects(
    setDoc(doc(firestore, 'attendanceQrTokens', fixture.sessionId), {
      sessionId: fixture.sessionId,
      tokenHash: 'client-controlled',
    }),
    { code: 'permission-denied' },
  );
});

test('authorized assistant cancellation excludes QR attendance from present recap', async () => {
  const fixture = await createFixture();
  const assistant = await assignAssistantOwner(fixture);
  const qr = await issueQr(fixture.sessionId);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, fixture.email, PASSWORD);
  await submitQr(fixture.sessionId, qr.data.qrPayload);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, assistant.email, PASSWORD);
  const attendanceId = `${fixture.sessionId}_${fixture.uid}`;
  const originalAttendance = (await getDoc(doc(firestore, 'attendances', attendanceId))).data();
  await cancel({ sessionId: fixture.sessionId, attendanceId, reason: 'QR review' });
  const attendance = (await getDoc(doc(firestore, 'attendances', attendanceId))).data();
  assert.equal(attendance.attendanceMethod, 'qr');
  assert.equal(attendance.status, 'dibatalkan');
  assert.equal(attendance.latitude, originalAttendance.latitude);
  assert.equal(attendance.longitude, originalAttendance.longitude);
  assert.equal(attendance.distanceMeters, originalAttendance.distanceMeters);
  assert.equal(attendance.accuracyMeters, originalAttendance.accuracyMeters);
  const present = await getDocs(query(
    collection(firestore, 'attendances'),
    where('sessionId', '==', fixture.sessionId),
    where('status', '==', 'hadir'),
  ));
  assert.equal(present.size, 0);
});

test('class and schedule persist across login and are visible only through matching enrollment', async () => {
  const assistant = await createAccount('asisten');
  const courseId = nextId('course');
  await adminFirestore.doc(`courseCatalog/${courseId}`).set({
    name: 'Test course',
    semester: 3,
    semesterParity: 'ganjil',
  });
  await adminAuth.setCustomUserClaims(assistant.uid, { assistantSemesterParity: 'ganjil' });
  await auth.currentUser.getIdToken(true);
  const classId = nextId('class');
  const scheduleId = nextId('schedule');
  await setDoc(doc(firestore, 'classes', classId), {
    courseId,
    className: 'A3',
    createdAt: new Date().toISOString(),
    semester: 3,
    semesterParity: 'ganjil',
    assistantUid: assistant.uid,
  });
  await setDoc(doc(firestore, 'schedules', scheduleId), {
    classId,
    courseId,
    dayOfWeek: 3,
    startTime: '08:00',
    endTime: '10:00',
    room: 'Lab Emulator',
    semesterParity: 'ganjil',
    assistantUid: assistant.uid,
  });
  await signOut(auth);
  await signInWithEmailAndPassword(auth, assistant.email, PASSWORD);
  assert.equal((await getDoc(doc(firestore, 'classes', classId))).exists(), true);
  assert.equal((await getDoc(doc(firestore, 'schedules', scheduleId))).exists(), true);

  const student = await createAccount('praktikan');
  await adminFirestore.doc(`enrollments/${classId}_${student.uid}`).set({
    praktikanId: student.uid,
    classId,
  });
  const schedules = await getDocs(query(
    collection(firestore, 'schedules'),
    where('classId', '==', classId),
  ));
  assert.equal(schedules.docs.some((item) => item.id === scheduleId), true);
});
