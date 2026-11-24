const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'demo-tandaiu-rules';
const AUTH_EMULATOR = '127.0.0.1:9099';
const FIRESTORE_EMULATOR = '127.0.0.1:8080';
const API_KEY = 'demo-api-key';
const LABORATORY_ID = 'emu-laboratory-main';
const COLLECTIONS = [
  'users', 'courseCatalog', 'studentDirectory', 'classes',
  'schedules', 'sessions', 'enrollments', 'attendances', 'permits', 'reviews',
  'laboratories',
];
const RESET_COLLECTIONS = ['enrollments', 'attendances', 'permits', 'reviews'];

const students = [
  { id: 'emu-praktikan-odd-1', name: 'Praktikan Ganjil Terdaftar', studentCode: '99990000000001', semester: 3, classId: 'emu-class-odd-3' },
  { id: 'emu-praktikan-odd-2', name: 'Praktikan Ganjil Belum Terdaftar', studentCode: '99990000000002', semester: 3, classId: null },
  { id: 'emu-praktikan-odd-3', name: 'Praktikan Ganjil Semester 1', studentCode: '99990000000003', semester: 1, classId: 'emu-class-odd-1' },
  { id: 'emu-praktikan-even-1', name: 'Praktikan Genap Terdaftar', studentCode: '99990000000004', semester: 4, classId: 'emu-class-even-4' },
  { id: 'emu-praktikan-even-2', name: 'Praktikan Genap Belum Terdaftar', studentCode: '99990000000005', semester: 4, classId: null },
  { id: 'emu-praktikan-even-3', name: 'Praktikan Genap Semester 2', studentCode: '99990000000006', semester: 2, classId: 'emu-class-even-2' },
  { id: 'emu-praktikan-odd-unenrolled', name: 'Praktikan Uji Belum Terdaftar', studentCode: '99990000000007', semester: 3, classId: null },
];

const assistants = [
  { id: 'emu-asprak-ganjil', email: 'asprak.ganjil@example.com', name: 'Asprak Ganjil', parity: 'ganjil' },
  { id: 'emu-asprak-genap', email: 'asprak.genap@example.com', name: 'Asprak Genap', parity: 'genap' },
];

const courses = [
  { id: 'dasar-pemrograman', name: 'Dasar Pemrograman', semester: 1, parity: 'ganjil', classId: 'emu-class-odd-1', className: 'A1', assistantUid: assistants[0].id, dayOfWeek: 1 },
  { id: 'struktur-data', name: 'Struktur Data', semester: 3, parity: 'ganjil', classId: 'emu-class-odd-3', className: 'A3', assistantUid: assistants[0].id, dayOfWeek: 3 },
  { id: 'algoritma-dan-pemrograman', name: 'Algoritma dan Pemrograman', semester: 2, parity: 'genap', classId: 'emu-class-even-2', className: 'B2', assistantUid: assistants[1].id, dayOfWeek: 2 },
  { id: 'pemrograman-berorientasi-objek', name: 'Pemrograman Berorientasi Objek', semester: 4, parity: 'genap', classId: 'emu-class-even-4', className: 'B4', assistantUid: assistants[1].id, dayOfWeek: 4 },
];

function requireLocalConfiguration() {
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR !== 'true') {
    throw new Error('Seed ditolak: aktifkan EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true di .env.development.local.');
  }
  if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT_ID) {
    throw new Error(`Seed ditolak: project harus tepat ${PROJECT_ID}.`);
  }
  if (!process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST) {
    throw new Error('Seed ditolak: EXPO_PUBLIC_FIREBASE_EMULATOR_HOST belum diisi.');
  }
  const password = process.env.TANDAIU_EMULATOR_DUMMY_PASSWORD;
  if (!password || password.length < 8 || password.includes('CHANGE_ME')) {
    throw new Error('Seed ditolak: isi TANDAIU_EMULATOR_DUMMY_PASSWORD (minimal 8 karakter) di .env.development.local.');
  }

  for (const [name, expected] of [
    ['FIREBASE_AUTH_EMULATOR_HOST', AUTH_EMULATOR],
    ['FIRESTORE_EMULATOR_HOST', FIRESTORE_EMULATOR],
  ]) {
    const configured = process.env[name];
    if (configured && configured !== expected) {
      throw new Error(`Seed ditolak: ${name} harus menunjuk ke ${expected}, bukan ${configured}.`);
    }
    process.env[name] = expected;
  }
  return password;
}

function isNotFound(error) {
  return error?.code === 'auth/user-not-found';
}

async function ensureAuthUser(auth, account, password, claims = null) {
  let existingByEmail;
  try {
    existingByEmail = await auth.getUserByEmail(account.email);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  if (existingByEmail && existingByEmail.uid !== account.id) {
    throw new Error(`Email ${account.email} sudah dipakai UID ${existingByEmail.uid}; seed berhenti tanpa menimpa akun itu.`);
  }

  let user;
  try {
    user = await auth.getUser(account.id);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (user) {
    if (user.email !== account.email) {
      throw new Error(`UID ${account.id} sudah dimiliki email lain; seed berhenti tanpa menimpa akun itu.`);
    }
    user = await auth.updateUser(account.id, {
      email: account.email,
      password,
      displayName: account.name,
      emailVerified: true,
      disabled: false,
    });
  } else {
    user = await auth.createUser({
      uid: account.id,
      email: account.email,
      password,
      displayName: account.name,
      emailVerified: true,
      disabled: false,
    });
  }
  await auth.setCustomUserClaims(user.uid, claims);
  return user;
}

async function verifyEmulatorLogin(account, password, expectedParity) {
  const response = await fetch(
    `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email, password, returnSecureToken: true }),
    },
  );
  const result = await response.json();
  if (!response.ok || typeof result.idToken !== 'string') {
    throw new Error(`Login Auth Emulator gagal untuk ${account.email}: ${result.error?.message ?? response.status}.`);
  }
  const payloadPart = result.idToken.split('.')[1];
  const tokenClaims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  if (tokenClaims.user_id !== account.id || tokenClaims.sub !== account.id) {
    throw new Error(`UID token Auth Emulator tidak cocok untuk ${account.email}.`);
  }
  if (expectedParity && tokenClaims.assistantSemesterParity !== expectedParity) {
    throw new Error(`Custom claim assistantSemesterParity tidak cocok untuk ${account.email}.`);
  }
  if (!expectedParity && tokenClaims.assistantSemesterParity !== undefined) {
    throw new Error(`Akun praktikan ${account.email} tidak boleh memiliki claim Asprak.`);
  }
}

function buildFirestoreDocuments(now) {
  const records = [];
  const add = (collection, id, data) => records.push({ collection, id, data });

  assistants.forEach((assistant) => add('users', assistant.id, {
    uid: assistant.id,
    name: assistant.name,
    email: assistant.email,
    role: 'asisten',
    authProvider: 'password',
  }));
  students.forEach((student) => add('users', student.id, {
    uid: student.id,
    name: student.name,
    email: `${student.id}@example.com`,
    role: 'praktikan',
    authProvider: 'password',
    studentCode: student.studentCode,
  }));

  courses.forEach((course) => {
    add('courseCatalog', course.id, {
      semester: course.semester,
      semesterParity: course.parity,
    });
    add('classes', course.classId, {
      courseId: course.id,
      className: course.className,
      createdAt: '2026-01-01T00:00:00.000Z',
      semester: course.semester,
      semesterParity: course.parity,
      assistantUid: course.assistantUid,
    });
    add('schedules', `emu-schedule-${course.classId}`, {
      classId: course.classId,
      courseId: course.id,
      dayOfWeek: course.dayOfWeek,
      startTime: '08:00',
      endTime: '10:00',
      room: `Lab ${course.className}`,
      semesterParity: course.parity,
      assistantUid: course.assistantUid,
    });
  });

  students.forEach((student) => add('studentDirectory', student.id, {
    name: student.name,
    studentCode: student.studentCode,
    semester: student.semester,
    semesterParity: student.semester % 2 ? 'ganjil' : 'genap',
  }));

  add('laboratories', LABORATORY_ID, {
    name: 'Laboratorium Emulator',
    lat: 0,
    lon: 0,
    radius: 100,
    lantai: 2,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const sessionsByClass = new Map();
  for (const course of courses) {
    const windows = [
      { status: 'dibuka', startsAt: now - 30 * 60_000, endsAt: now + 4 * 60 * 60_000 },
      { status: 'terjadwal', startsAt: now + 24 * 60 * 60_000, endsAt: now + 26 * 60 * 60_000 },
      { status: 'ditutup', startsAt: now - 48 * 60 * 60_000, endsAt: now - 46 * 60 * 60_000 },
    ];
    windows.forEach((window, index) => {
      const id = `emu-session-${course.classId}-${index + 1}`;
      add('sessions', id, {
        classId: course.classId,
        courseId: course.id,
        practicumName: course.name,
        className: course.className,
        startsAt: new Date(window.startsAt),
        endsAt: new Date(window.endsAt),
        status: window.status,
        lecturerId: 'dos-01',
        lecturer: 'Nurul Hidayati, S.Kom., M.Kom.',
        semester: course.semester,
        semesterParity: course.parity,
        assistantUid: course.assistantUid,
        laboratoryId: LABORATORY_ID,
      });
      if (!sessionsByClass.has(course.classId)) sessionsByClass.set(course.classId, []);
      sessionsByClass.get(course.classId).push(id);
    });

    const unenrolledStudent = students.find(
      (student) => student.semester === course.semester && student.classId === null,
    );
    if (unenrolledStudent) {
      const openSessionId = `emu-session-${course.classId}-1`;
      const closedSessionId = `emu-session-${course.classId}-3`;
      add('permits', `${openSessionId}_${unenrolledStudent.id}`, {
        sessionId: openSessionId,
        studentId: unenrolledStudent.id,
        studentName: unenrolledStudent.name,
        reason: 'Permohonan uji pengelolaan izin.',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      add('reviews', `${closedSessionId}_${unenrolledStudent.id}`, {
        sessionId: closedSessionId,
        studentId: unenrolledStudent.id,
        studentName: unenrolledStudent.name,
        comment: 'Ulasan uji untuk Asprak pemilik sesi.',
        sentiment: 'positif',
        sentimentSource: 'fallback',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    }
  }

  students.filter((student) => student.classId).forEach((student) => {
    const course = courses.find((item) => item.classId === student.classId);
    add('enrollments', `${student.classId}_${student.id}`, {
      praktikanId: student.id,
      praktikanName: student.name,
      studentCode: student.studentCode,
      classId: student.classId,
      courseId: course.id,
      semester: student.semester,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  return records;
}

function writeLocalCredentials(password) {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share');
  const directory = path.join(base, 'TandaIU');
  const file = path.join(directory, 'LOCAL-EMULATOR-CREDENTIALS.md');
  const body = [
    '<!-- Generated by scripts/seed-firebase-emulator.cjs; emulator only. -->',
    '# TandaIU local Emulator test accounts',
    '',
    `Shared password: \`${password}\``,
    '',
    '| Role | Email | UID |',
    '|---|---|---|',
    ...assistants.map((item) => `| Asprak ${item.parity} | ${item.email} | \`${item.id}\` |`),
    ...students.map((item) => `| Praktikan semester ${item.semester} | ${item.id}@example.com | \`${item.id}\` |`),
    '',
    'These accounts exist only in the local Firebase Emulator project `demo-tandaiu-rules`.',
    'Do not use these credentials with a production Firebase project.',
    '',
  ].join('\n');

  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');
    if (!existing.startsWith('<!-- Generated by scripts/seed-firebase-emulator.cjs; emulator only. -->')) {
      throw new Error(`File kredensial sudah ada dan bukan file seed; tidak ditimpa: ${file}`);
    }
  }
  fs.writeFileSync(file, body, { encoding: 'utf8', mode: 0o600 });
  return file;
}

async function main() {
  const password = requireLocalConfiguration();
  const accounts = [
    ...assistants.map((assistant) => ({
      id: assistant.id,
      name: assistant.name,
      email: assistant.email,
      claims: { assistantSemesterParity: assistant.parity },
      parity: assistant.parity,
    })),
    ...students.map((student) => ({
      id: student.id,
      name: student.name,
      email: `${student.id}@example.com`,
      studentCode: student.studentCode,
      claims: null,
      parity: null,
    })),
  ];

  const app = initializeApp({ projectId: PROJECT_ID }, 'tandaiu-local-emulator-seed');
  const auth = getAuth(app);
  const db = getFirestore(app);

  await auth.listUsers(1);
  await db.listCollections();
  for (const collectionName of RESET_COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    for (let start = 0; start < snapshot.docs.length; start += 450) {
      const batch = db.batch();
      snapshot.docs.slice(start, start + 450).forEach((document) => batch.delete(document.ref));
      await batch.commit();
    }
  }

  for (const account of accounts) {
    await ensureAuthUser(auth, account, password, account.claims);
  }

  const records = buildFirestoreDocuments(Date.now());
  for (let start = 0; start < records.length; start += 450) {
    const batch = db.batch();
    records.slice(start, start + 450).forEach(({ collection, id, data }) => {
      batch.set(db.collection(collection).doc(id), data);
    });
    await batch.commit();
  }

  for (const account of accounts) {
    await verifyEmulatorLogin(account, password, account.parity);
  }

  const counts = Object.fromEntries(COLLECTIONS.map((collection) => [collection, 0]));
  records.forEach(({ collection }) => { counts[collection] += 1; });
  const credentialsFile = writeLocalCredentials(password);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Auth Emulator: ${AUTH_EMULATOR}; Firestore Emulator: ${FIRESTORE_EMULATOR}`);
  console.log(`Verified Auth Emulator email/password login and custom claims for ${accounts.length} accounts.`);
  console.log(`Seeded documents: ${JSON.stringify(counts)}`);
  console.log(`Local test credentials written outside the repository: ${credentialsFile}`);
  console.log('The seed only targets local emulator endpoints and never initializes a production credential.');
}

main().catch((error) => {
  console.error(`Emulator seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
