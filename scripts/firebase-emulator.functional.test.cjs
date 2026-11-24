const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const { deleteApp, initializeApp } = require('firebase/app');
const {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
} = require('firebase/auth');
const {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  setDoc,
  terminate,
  updateDoc,
  where,
} = require('firebase/firestore');
const {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} = require('firebase/functions');

const PROJECT_ID = 'demo-tandaiu-rules';
const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
const password = process.env.TANDAIU_EMULATOR_DUMMY_PASSWORD;
const authBase = `http://${emulatorHost}:9099`;
const firestoreBase = `http://${emulatorHost}:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR !== 'true'
  || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT_ID
  || !emulatorHost || /:\/\/|\s/.test(emulatorHost)
  || !password || password.length < 8
  || !API_KEY) {
  throw new Error('Functional tests require valid emulator-only settings in .env.development.local.');
}

const firebaseApp = initializeApp({
  apiKey: API_KEY,
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
}, 'tandaiu-functional-emulator');
const firebaseAuth = getAuth(firebaseApp);
connectAuthEmulator(firebaseAuth, authBase, { disableWarnings: true });
const firebaseDb = getFirestore(firebaseApp);
connectFirestoreEmulator(firebaseDb, emulatorHost, 8080);
const firebaseFunctions = getFunctions(firebaseApp, 'us-central1');
connectFunctionsEmulator(firebaseFunctions, emulatorHost, 5001);

async function signInWithSdk(email) {
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

async function signIn(email) {
  const response = await fetch(
    `${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  assert.equal(response.ok, true, `Auth Emulator rejected sign-in for ${email}: ${body.error?.message ?? response.status}`);
  return {
    token: body.idToken,
    uid: body.localId,
    claims: JSON.parse(Buffer.from(body.idToken.split('.')[1], 'base64url').toString('utf8')),
  };
}

function firestoreValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  return value;
}

function firestoreDocument(document) {
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [key, firestoreValue(value)]),
  );
}

async function getDocument(token, collection, id) {
  const response = await fetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.ok, true, `Firestore ${collection}/${id} read failed: ${response.status}`);
  return firestoreDocument(await response.json());
}

async function runQuery(token, collection, filters) {
  const where = filters.length === 1
    ? { fieldFilter: filters[0] }
    : { compositeFilter: { op: 'AND', filters: filters.map((fieldFilter) => ({ fieldFilter })) } };
  const response = await fetch(`${firestoreBase}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where,
      },
    }),
  });
  const responseText = await response.text();
  assert.equal(response.ok, true, `Firestore query for ${collection} failed: ${response.status} ${responseText}`);
  return JSON.parse(responseText).flatMap((item) => item.document ? [firestoreDocument(item.document)] : []);
}

function equals(field, value) {
  return { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } };
}

after(async () => {
  // Keep this suite's output free of local passwords and tokens.
  if (process.env.TANDAIU_EMULATOR_DUMMY_PASSWORD) {
    process.env.TANDAIU_EMULATOR_DUMMY_PASSWORD = '';
  }
  await terminate(firebaseDb);
  await deleteApp(firebaseApp);
});

test('Auth Emulator and Firestore Emulator answer at the configured host', async () => {
  const authResponse = await fetch(
    `${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  assert.equal(authResponse.status, 400, 'Auth Emulator did not return the expected validation response.');
  const firestoreResponse = await fetch(`http://${emulatorHost}:8080/`);
  assert.equal(firestoreResponse.status, 200, 'Firestore Emulator endpoint did not respond.');
});

for (const account of [
  { email: 'emu-praktikan-odd-1@example.com', uid: 'emu-praktikan-odd-1', role: 'praktikan' },
  { email: 'asprak.ganjil@example.com', uid: 'emu-asprak-ganjil', role: 'asisten', parity: 'ganjil' },
  { email: 'asprak.genap@example.com', uid: 'emu-asprak-genap', role: 'asisten', parity: 'genap' },
]) {
  test(`email/password login and Firestore profile: ${account.email}`, async () => {
    const session = await signIn(account.email);
    assert.equal(session.uid, account.uid);
    assert.equal(session.claims.aud, PROJECT_ID);
    assert.equal(session.claims.assistantSemesterParity, account.parity);
    const profile = await getDocument(session.token, 'users', account.uid);
    assert.equal(profile.uid, account.uid);
    assert.equal(profile.role, account.role);
  });
}

test('Praktikan uses enrolled-session attendance, permit, review, and private history', async () => {
  const credentials = await signInWithSdk('emu-praktikan-odd-1@example.com');
  const uid = credentials.user.uid;
  const profile = await getDoc(doc(firebaseDb, 'users', uid));
  assert.equal(profile.data().role, 'praktikan');

  const enrollments = await getDocs(query(
    collection(firebaseDb, 'enrollments'),
    where('praktikanId', '==', uid),
  ));
  assert.equal(enrollments.size, 1);
  const enrollment = enrollments.docs[0].data();
  const sessions = await getDocs(query(
    collection(firebaseDb, 'sessions'),
    where('classId', '==', enrollment.classId),
  ));
  const openSession = sessions.docs.find((item) => item.data().status === 'dibuka');
  const closedSession = sessions.docs.find((item) => item.data().status === 'ditutup');
  assert.ok(openSession);
  assert.ok(closedSession);

  const attendanceRef = doc(firebaseDb, 'attendances', `${openSession.id}_${uid}`);
  const submitAttendance = httpsCallable(firebaseFunctions, 'submitAttendance');
  const attendance = await submitAttendance({
    sessionId: openSession.id,
    latitude: 0,
    longitude: 0,
    accuracyMeters: 10,
  });
  assert.equal(attendance.data.ok, true);

  const attendanceHistory = await getDocs(query(
    collection(firebaseDb, 'attendances'),
    where('praktikanId', '==', uid),
  ));
  assert.ok(attendanceHistory.docs.some((item) => item.id === attendanceRef.id));
  const scopedSessionAttendance = await getDocs(query(
    collection(firebaseDb, 'attendances'),
    where('sessionId', '==', openSession.id),
    where('praktikanId', '==', uid),
  ));
  assert.equal(scopedSessionAttendance.size, 1);
  await assert.rejects(
    getDocs(query(collection(firebaseDb, 'attendances'), where('sessionId', '==', openSession.id))),
    { code: 'permission-denied' },
  );

  const permitRef = doc(firebaseDb, 'permits', `${openSession.id}_${uid}`);
  await runTransaction(firebaseDb, async (transaction) => {
    const missing = await transaction.get(permitRef);
    assert.equal(missing.exists(), false);
    transaction.set(permitRef, {
      sessionId: openSession.id,
      studentId: uid,
      studentName: profileSnapshotName(profile),
      reason: 'Permohonan izin uji emulator.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  });

  const reviewRef = doc(firebaseDb, 'reviews', `${closedSession.id}_${uid}`);
  await setDoc(reviewRef, {
    sessionId: closedSession.id,
    studentId: uid,
    studentName: profileSnapshotName(profile),
    comment: 'Praktikum berjalan dengan baik.',
    sentiment: 'positif',
    sentimentSource: 'fallback',
    createdAt: new Date().toISOString(),
  });
  assert.equal((await getDoc(reviewRef)).exists(), true);
});

function profileSnapshotName(snapshot) {
  const name = snapshot.data()?.name;
  assert.equal(typeof name, 'string');
  return name;
}

for (const account of [
  {
    email: 'asprak.ganjil@example.com',
    uid: 'emu-asprak-ganjil',
    parity: 'ganjil',
    classId: 'emu-class-odd-3',
    sessionId: 'emu-session-emu-class-odd-3-2',
    scheduleId: 'emu-schedule-emu-class-odd-3',
    studentId: 'emu-praktikan-odd-2',
    studentName: 'Praktikan Ganjil Belum Terdaftar',
    otherStudentId: 'emu-praktikan-even-2',
    otherClassId: 'emu-class-even-4',
  },
  {
    email: 'asprak.genap@example.com',
    uid: 'emu-asprak-genap',
    parity: 'genap',
    classId: 'emu-class-even-4',
    sessionId: 'emu-session-emu-class-even-4-2',
    scheduleId: 'emu-schedule-emu-class-even-4',
    studentId: 'emu-praktikan-even-2',
    studentName: 'Praktikan Genap Belum Terdaftar',
    otherStudentId: 'emu-praktikan-odd-2',
    otherClassId: 'emu-class-odd-3',
  },
]) {
  test(`Asprak ${account.parity} manages only assigned sessions and enrollments`, async () => {
    const credentials = await signInWithSdk(account.email);
    assert.equal(credentials.user.uid, account.uid);
    const token = await credentials.user.getIdTokenResult();
    assert.equal(token.claims.assistantSemesterParity, account.parity);

    const ownSessions = await getDocs(query(
      collection(firebaseDb, 'sessions'),
      where('assistantUid', '==', account.uid),
      where('semesterParity', '==', account.parity),
    ));
    assert.ok(ownSessions.size > 0);
    assert.equal((await getDoc(doc(firebaseDb, 'classes', account.classId))).exists(), true);
    await assert.rejects(
      getDoc(doc(firebaseDb, 'classes', account.otherClassId)),
      { code: 'permission-denied' },
    );

    await updateDoc(doc(firebaseDb, 'sessions', account.sessionId), { status: 'dibuka' });
    await updateDoc(doc(firebaseDb, 'sessions', account.sessionId), { status: 'ditutup' });
    await updateDoc(doc(firebaseDb, 'schedules', account.scheduleId), { room: 'Lab Emulator Teruji' });

    const directorySnapshot = await getDoc(doc(firebaseDb, 'studentDirectory', account.studentId));
    const classSnapshot = await getDoc(doc(firebaseDb, 'classes', account.classId));
    assert.equal(directorySnapshot.exists(), true);
    assert.equal(classSnapshot.exists(), true);
    const directory = directorySnapshot.data();
    const classData = classSnapshot.data();
    const enrollmentRef = doc(firebaseDb, 'enrollments', `${account.classId}_${account.studentId}`);
    await setDoc(enrollmentRef, {
      praktikanId: account.studentId,
      praktikanName: directory.name,
      studentCode: directory.studentCode,
      classId: account.classId,
      courseId: classData.courseId,
      semester: classData.semester,
      createdAt: new Date().toISOString(),
    });
    assert.equal((await getDoc(enrollmentRef)).exists(), true);

    const permitSessionId = `emu-session-${account.classId}-1`;
    const permitId = `${permitSessionId}_${account.studentId}`;
    const permits = await getDocs(query(
      collection(firebaseDb, 'permits'),
      where('sessionId', '==', permitSessionId),
    ));
    const permit = permits.docs.find((item) => item.id === permitId);
    assert.ok(permit);
    assert.equal(permit.data().status, 'pending');
    await updateDoc(doc(firebaseDb, 'permits', permitId), {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: account.parity === 'ganjil' ? 'Asprak Ganjil' : 'Asprak Genap',
    });
    assert.equal((await getDoc(doc(firebaseDb, 'permits', permitId))).data().status, 'approved');

    const reviewSessionId = `emu-session-${account.classId}-3`;
    const reviewId = `${reviewSessionId}_${account.studentId}`;
    assert.equal((await getDoc(doc(firebaseDb, 'reviews', reviewId))).exists(), true);
    const otherReviewId = `emu-session-${account.otherClassId}-3_${account.otherStudentId}`;
    await assert.rejects(
      getDoc(doc(firebaseDb, 'reviews', otherReviewId)),
      { code: 'permission-denied' },
    );
  });
}

for (const account of [
  { email: 'asprak.ganjil@example.com', uid: 'emu-asprak-ganjil', parity: 'ganjil' },
  { email: 'asprak.genap@example.com', uid: 'emu-asprak-genap', parity: 'genap' },
]) {
  test(`${account.parity} Asprak reads only sessions in the assigned parity`, async () => {
    const session = await signIn(account.email);
    const sessions = await runQuery(session.token, 'sessions', [
      equals('assistantUid', account.uid),
      equals('semesterParity', account.parity),
    ]);
    assert.ok(sessions.length > 0);
    assert.ok(sessions.every((item) => item.assistantUid === account.uid && item.semesterParity === account.parity));
  });
}

test('enrolled Praktikan reads its enrollment and class sessions', async () => {
  const session = await signIn('emu-praktikan-odd-1@example.com');
  const enrollments = await runQuery(session.token, 'enrollments', [
    equals('praktikanId', session.uid),
  ]);
  assert.equal(enrollments.length, 1);
  assert.equal(enrollments[0].praktikanId, session.uid);
  const sessions = await runQuery(session.token, 'sessions', [
    equals('classId', enrollments[0].classId),
  ]);
  assert.ok(sessions.length > 0);
  assert.ok(sessions.every((item) => item.classId === enrollments[0].classId));
});

test('unenrolled Praktikan cannot read a different class or create attendance', async () => {
  const session = await signIn('emu-praktikan-odd-unenrolled@example.com');
  const enrollments = await runQuery(session.token, 'enrollments', [
    equals('praktikanId', session.uid),
  ]);
  assert.equal(enrollments.length, 0);

  const sessionId = 'emu-session-emu-class-odd-3-1';
  const readResponse = await fetch(`${firestoreBase}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal(readResponse.status, 403, 'Unenrolled Praktikan unexpectedly read a session.');

  const attendanceId = `${sessionId}_${session.uid}`;
  const writeResponse = await fetch(`${firestoreBase}/attendances/${attendanceId}?currentDocument.exists=false`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        sessionId: { stringValue: sessionId },
        praktikanId: { stringValue: session.uid },
        praktikanName: { stringValue: 'Unenrolled test account' },
        attendedAt: { timestampValue: new Date().toISOString() },
        status: { stringValue: 'hadir' },
      },
    }),
  });
  assert.equal(writeResponse.status, 403, 'Unenrolled Praktikan unexpectedly created attendance.');
});
