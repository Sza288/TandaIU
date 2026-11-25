import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let environment: RulesTestEnvironment;

const userRecord = (role: 'praktikan' | 'asisten', name: string, studentCode?: string) => ({
  role,
  name,
  email: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
  authProvider: 'password',
  ...(studentCode ? { studentCode } : {}),
});

const parityFor = (semester: number) => semester % 2 === 1 ? 'ganjil' : 'genap';

const courseRecord = (semester: number) => ({
  courseId: `course-${semester}`,
  name: `Mata Kuliah ${semester}`,
  semester,
  semesterParity: parityFor(semester),
});

const classRecord = (assistantUid: string, semester: number, className = `A${semester}`) => ({
  courseId: `course-${semester}`,
  className,
  createdAt: '2026-01-01T00:00:00.000Z',
  semester,
  semesterParity: parityFor(semester),
  assistantUid,
});

const sessionRecord = (
  classId: string,
  assistantUid: string,
  semester: number,
  status: 'terjadwal' | 'dibuka' | 'ditutup' = 'dibuka',
  startsAt = Timestamp.fromMillis(Date.now() - 5 * 60_000),
  endsAt = Timestamp.fromMillis(Date.now() + 5 * 60_000),
) => ({
  classId,
  courseId: `course-${semester}`,
  practicumName: 'Praktikum uji',
  className: `A${semester}`,
  startsAt,
  endsAt,
  status,
  lecturerId: 'dosen-uji',
  lecturer: 'Dosen Uji',
  semester,
  semesterParity: parityFor(semester),
  assistantUid,
});

const scheduleRecord = (classId: string, assistantUid: string, semester: number) => ({
  classId,
  courseId: `course-${semester}`,
  dayOfWeek: 2,
  startTime: '08:00',
  endTime: '10:00',
  room: 'Lab Uji',
  semesterParity: parityFor(semester),
  assistantUid,
});

const enrollmentRecord = (praktikanId: string, name: string, studentCode: string, semester: number) => ({
  praktikanId,
  praktikanName: name,
  studentCode,
  classId: `class-${parityFor(semester)}`,
  courseId: `course-${semester}`,
  semester,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const directoryRecord = (name: string, studentCode: string, semester: number) => ({
  name,
  studentCode,
  semester,
  semesterParity: parityFor(semester),
});

const permitRecord = (sessionId: string, studentId: string, studentName: string) => ({
  sessionId,
  studentId,
  studentName,
  reason: 'Alasan uji yang cukup panjang',
  sentiment: 'netral',
  sentimentSource: 'fallback',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const reviewRecord = (sessionId: string, studentId: string, studentName: string) => ({
  sessionId,
  studentId,
  studentName,
  comment: 'Komentar uji yang cukup panjang',
  sentiment: 'positif',
  sentimentSource: 'fallback',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const attendanceRecord = (
  sessionId: string,
  praktikanId: string,
  praktikanName: string,
  attendanceMethod: 'location' | 'qr' = 'location',
  qrToken?: string,
) => ({
  sessionId,
  praktikanId,
  praktikanName,
  attendedAt: serverTimestamp(),
  status: 'hadir',
  attendanceMethod,
  latitude: -7.0482469,
  longitude: 110.4407531,
  accuracyMeters: 10,
  distanceMeters: 0,
  laboratoryId: 'lab-b',
  laboratoryName: 'Laboratorium B',
  radiusMeters: 500,
  ...(qrToken ? { qrToken } : {}),
});

const laboratoryRecord = (name = 'Laboratorium B', overrides: Record<string, unknown> = {}) => ({
  name,
  latitude: -7.0482469,
  longitude: 110.4407531,
  radius: 500,
  lantai: 2,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

async function seed(): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const documents: [string, string, Record<string, unknown>][] = [
      ['users', 'asprak-odd', userRecord('asisten', 'Asprak Ganjil')],
      ['users', 'asprak-even', userRecord('asisten', 'Asprak Genap')],
      ['users', 'student-enrolled', userRecord('praktikan', 'Mahasiswa Terdaftar', '123')],
      ['users', 'student-new', userRecord('praktikan', 'Mahasiswa Baru', '124')],
      ['users', 'student-even', userRecord('praktikan', 'Mahasiswa Genap', '456')],
      ['users', 'student-even-new', userRecord('praktikan', 'Mahasiswa Genap Baru', '457')],
      ['users', 'student-outside', userRecord('praktikan', 'Mahasiswa Luar', '789')],
      ['courseCatalog', 'course-1', courseRecord(1)],
      ['courseCatalog', 'course-2', courseRecord(2)],
      ['classes', 'class-ganjil', classRecord('asprak-odd', 1)],
      ['classes', 'class-genap', classRecord('asprak-even', 2)],
      ['classes', 'class-kosong', classRecord('asprak-odd', 1, 'B1')],
      ['sessions', 'session-ganjil', sessionRecord('class-ganjil', 'asprak-odd', 1)],
      ['laboratories', 'lab-b', laboratoryRecord('Laboratorium B')],
      ['laboratories', 'lab-c', laboratoryRecord('Laboratorium C')],
      ['sessions', 'session-with-lab', {
        ...sessionRecord('class-ganjil', 'asprak-odd', 1),
        laboratoryId: 'lab-b',
      }],
      ['sessions', 'session-genap', sessionRecord('class-genap', 'asprak-even', 2)],
      ['sessions', 'session-legacy-iso', {
        ...sessionRecord('class-ganjil', 'asprak-odd', 1),
        startsAt: '2026-01-01T09:00:00+07:00',
        endsAt: '2026-01-01T11:00:00+07:00',
      }],
      ['sessions', 'session-ditutup', sessionRecord('class-ganjil', 'asprak-odd', 1, 'ditutup')],
      ['sessions', 'session-ditutup-2', sessionRecord('class-ganjil', 'asprak-odd', 1, 'ditutup')],
      ['sessions', 'session-terjadwal', sessionRecord('class-ganjil', 'asprak-odd', 1, 'terjadwal')],
      ['sessions', 'session-terjadwal-legacy', {
        classId: 'class-ganjil',
        courseId: 'course-1',
        practicumName: 'Praktikum uji',
        className: 'A1',
        startsAt: '2026-01-01T09:00:00+07:00',
        endsAt: '2026-01-01T11:00:00+07:00',
        status: 'terjadwal',
        semester: 1,
        semesterParity: 'ganjil',
        assistantUid: 'asprak-odd',
      }],
      ['schedules', 'schedule-ganjil', scheduleRecord('class-ganjil', 'asprak-odd', 1)],
      ['schedules', 'schedule-genap', scheduleRecord('class-genap', 'asprak-even', 2)],
      ['enrollments', 'class-ganjil_student-enrolled', enrollmentRecord('student-enrolled', 'Mahasiswa Terdaftar', '123', 1)],
      ['enrollments', 'class-ganjil_student-new', enrollmentRecord('student-new', 'Mahasiswa Baru', '124', 1)],
      ['enrollments', 'class-genap_student-even', enrollmentRecord('student-even', 'Mahasiswa Genap', '456', 2)],
      ['studentDirectory', 'student-enrolled', directoryRecord('Mahasiswa Terdaftar', '123', 1)],
      ['studentDirectory', 'student-new', directoryRecord('Mahasiswa Baru', '124', 1)],
      ['studentDirectory', 'student-even', directoryRecord('Mahasiswa Genap', '456', 2)],
      ['studentDirectory', 'student-even-new', directoryRecord('Mahasiswa Genap Baru', '457', 2)],
      ['studentDirectory', 'student-outside', directoryRecord('Mahasiswa Luar', '789', 1)],
      ['attendances', 'session-ganjil_student-enrolled', {
        sessionId: 'session-ganjil', praktikanId: 'student-enrolled',
        praktikanName: 'Mahasiswa Terdaftar', attendedAt: '2026-01-01T09:00:00.000Z', status: 'hadir',
      }],
      ['attendances', 'session-genap_student-even', {
        sessionId: 'session-genap', praktikanId: 'student-even',
        praktikanName: 'Mahasiswa Genap', attendedAt: '2026-01-01T10:00:00.000Z', status: 'hadir',
      }],
      ['permits', 'session-ganjil_student-enrolled', permitRecord('session-ganjil', 'student-enrolled', 'Mahasiswa Terdaftar')],
      ['permits', 'session-genap_student-even', permitRecord('session-genap', 'student-even', 'Mahasiswa Genap')],
      ['reviews', 'session-ditutup_student-enrolled', reviewRecord('session-ditutup', 'student-enrolled', 'Mahasiswa Terdaftar')],
      ['attendanceArchieve', 'archive-student-enrolled', {
        praktikanId: 'student-enrolled', sessionId: 'session-lama', status: 'hadir',
      }],
    ];
    await Promise.all(documents.map(([collectionName, id, data]) =>
      setDoc(doc(database, collectionName, id), data)));
  });
}

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

if (process.env.FIRESTORE_EMULATOR_HOST) {
  jest.setTimeout(30000);
}

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  environment = await initializeTestEnvironment({
    projectId: 'demo-tandaiu-rules',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  if (!environment) return;
  await environment.clearFirestore();
  await seed();
});

afterAll(async () => {
  await environment?.cleanup();
});

describeWithEmulator('Firestore Revisi 3 dan 4 access rules', () => {
  it('requires a valid profile and prevents self-promotion or profile mutation', async () => {
    const unauthenticated = environment.unauthenticatedContext().firestore();
    const noProfile = environment.authenticatedContext('no-profile', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const student = environment.authenticatedContext('student-enrolled').firestore();
    const newStudent = environment.authenticatedContext('student-created').firestore();

    await expect(getDoc(doc(unauthenticated, 'classes/class-ganjil')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDoc(doc(noProfile, 'classes/class-ganjil')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'users/student-promoted'), userRecord('asisten', 'Promosi')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    const newStudentProfile = doc(newStudent, 'users/student-created');
    await expect(setDoc(newStudentProfile, userRecord('praktikan', 'Praktikan Baru', '900')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(newStudentProfile, {
      ...userRecord('praktikan', 'Praktikan Baru', '900'),
      uid: 'another-user',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(newStudentProfile, {
      ...userRecord('praktikan', 'Praktikan Baru', '900'),
      uid: 'student-created',
    }))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(student, 'users/student-enrolled'), { role: 'asisten' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(student, 'users/student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(collection(student, 'users')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('keeps the course catalog server-managed and scopes student directory by identity and parity', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const student = environment.authenticatedContext('student-enrolled').firestore();

    await expect(getDoc(doc(odd, 'courseCatalog/course-1')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'courseCatalog/course-3'), courseRecord(3)))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDoc(doc(student, 'studentDirectory/student-enrolled'))).exists()).toBe(true);
    await expect(getDoc(doc(student, 'studentDirectory/student-even')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDocs(query(
      collection(odd, 'studentDirectory'), where('semesterParity', '==', 'ganjil'),
    ))).size).toBe(3);
    await expect(getDocs(query(
      collection(odd, 'studentDirectory'), where('semesterParity', '==', 'genap'),
    ))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'studentDirectory/student-enrolled'), { semester: 2 }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(odd, 'studentDirectory/student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('isolates class reads and CRUD by owner, claim parity, and catalog semester', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const even = environment.authenticatedContext('asprak-even', {
      assistantSemesterParity: 'genap',
    }).firestore();
    const student = environment.authenticatedContext('student-enrolled').firestore();

    expect((await getDoc(doc(odd, 'classes/class-ganjil'))).exists()).toBe(true);
    expect((await getDoc(doc(even, 'classes/class-genap'))).exists()).toBe(true);
    await expect(getDoc(doc(odd, 'classes/class-genap')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDoc(doc(student, 'classes/class-ganjil'))).exists()).toBe(true);
    await expect(getDoc(doc(student, 'classes/class-genap')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'classes/forged-owner'), classRecord('asprak-even', 1)))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'classes/wrong-course'), {
      ...classRecord('asprak-odd', 1), courseId: 'course-2',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'classes/extra-field'), {
      ...classRecord('asprak-odd', 1), isAdmin: true,
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'classes/class-ganjil'), { semester: 3 }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'classes/class-ganjil'), { assistantUid: 'asprak-even' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(even, 'classes/class-ganjil')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDoc(doc(student, 'enrollments/class-ganjil_student-enrolled'))).exists()).toBe(true);
    await expect(deleteDoc(doc(odd, 'classes/class-ganjil')))
      .resolves.toBeUndefined();
    await expect(deleteDoc(doc(odd, 'classes/class-kosong')))
      .resolves.toBeUndefined();
    await expect(deleteDoc(doc(student, 'classes/class-ganjil')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('allows schedules only within the assistant class scope', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const even = environment.authenticatedContext('asprak-even', {
      assistantSemesterParity: 'genap',
    }).firestore();
    const student = environment.authenticatedContext('student-enrolled').firestore();

    expect((await getDoc(doc(student, 'schedules/schedule-ganjil'))).exists()).toBe(true);
    expect((await getDoc(doc(even, 'schedules/schedule-genap'))).exists()).toBe(true);
    await expect(setDoc(doc(odd, 'schedules/schedule-new'), scheduleRecord('class-ganjil', 'asprak-odd', 1)))
      .resolves.toBeUndefined();
    await expect(setDoc(doc(odd, 'schedules/schedule-forged'), scheduleRecord('class-genap', 'asprak-odd', 2)))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(even, 'schedules/schedule-ganjil'), { room: 'Lain' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(even, 'schedules/schedule-ganjil')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'schedules/schedule-ganjil'), { room: 'Lab Baru' }))
      .resolves.toBeUndefined();
    await expect(deleteDoc(doc(odd, 'schedules/schedule-ganjil')))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(even, 'schedules/schedule-genap'), { room: 'Lab Genap Baru' }))
      .resolves.toBeUndefined();
  });

  it('validates session ownership, class relation, and supported status on every write', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const even = environment.authenticatedContext('asprak-even', {
      assistantSemesterParity: 'genap',
    }).firestore();
    const student = environment.authenticatedContext('student-enrolled').firestore();

    expect((await getDoc(doc(student, 'sessions/session-ganjil'))).exists()).toBe(true);
    expect((await getDoc(doc(student, 'sessions/session-legacy-iso'))).exists()).toBe(true);
    expect((await getDoc(doc(odd, 'sessions/session-legacy-iso'))).exists()).toBe(true);
    expect((await getDoc(doc(even, 'sessions/session-genap'))).exists()).toBe(true);
    await expect(getDoc(doc(student, 'sessions/session-genap')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(query(
      collection(student, 'sessions'), where('classId', '==', 'class-ganjil'),
    ))).resolves.toMatchObject({ size: 7 });
    await expect(getDocs(query(
      collection(odd, 'sessions'),
      where('assistantUid', '==', 'asprak-odd'),
      where('semesterParity', '==', 'ganjil'),
    ))).resolves.toMatchObject({ size: 7 });
    await expect(setDoc(doc(odd, 'sessions/session-new'), sessionRecord('class-ganjil', 'asprak-odd', 1, 'terjadwal')))
      .resolves.toBeUndefined();
    await expect(setDoc(doc(odd, 'sessions/session-new-open'), sessionRecord('class-ganjil', 'asprak-odd', 1, 'dibuka')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'sessions/session-new-closed'), sessionRecord('class-ganjil', 'asprak-odd', 1, 'ditutup')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'sessions/session-forged-owner'), sessionRecord('class-ganjil', 'asprak-even', 1)))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'sessions/session-wrong-class'), sessionRecord('class-genap', 'asprak-odd', 1)))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'sessions/session-invalid-status'), {
      ...sessionRecord('class-ganjil', 'asprak-odd', 1), status: 'cancelled',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'sessions/session-legacy-string-create'), {
      ...sessionRecord('class-ganjil', 'asprak-odd', 1),
      startsAt: '2026-01-01T10:00:00+07:00',
      endsAt: '2026-01-01T11:00:00+07:00',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-legacy-iso'), {
      startsAt: Timestamp.fromDate(new Date('2026-01-01T02:00:00.000Z')),
      endsAt: Timestamp.fromDate(new Date('2026-01-01T04:00:00.000Z')),
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal-legacy'), {
      startsAt: Timestamp.fromDate(new Date('2026-01-01T02:00:00.000Z')),
      endsAt: Timestamp.fromDate(new Date('2026-01-01T04:00:00.000Z')),
      lecturerId: 'dosen-uji',
      lecturer: 'Dosen Uji',
      laboratoryId: 'lab-b',
      scheduleId: 'schedule-ganjil',
    })).resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal'), {
      ...sessionRecord(
        'class-ganjil',
        'asprak-odd',
        1,
        'terjadwal',
        Timestamp.fromMillis(Date.now() - 5 * 60_000),
        Timestamp.fromMillis(Date.now() + 5 * 60_000),
      ),
      laboratoryId: 'lab-b',
    })).resolves.toBeUndefined();
    await expect(setDoc(doc(odd, 'sessions/session-invalid-interval'), {
      ...sessionRecord(
        'class-ganjil',
        'asprak-odd',
        1,
        'dibuka',
        Timestamp.fromMillis(Date.now()),
        Timestamp.fromMillis(Date.now() - 1),
      ),
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(even, 'sessions/session-ganjil'), { status: 'ditutup' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal'), { status: 'dibuka' }))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'sessions/session-genap'), { status: 'ditutup' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-ganjil'), { status: 'ditutup' }))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'sessions/session-ditutup'), {
      startsAt: Timestamp.fromDate(new Date('2026-01-03T02:00:00.000Z')),
      endsAt: Timestamp.fromDate(new Date('2026-01-03T04:00:00.000Z')),
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal'), { practicumName: 'Diubah Klien' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal'), { assistantUid: 'asprak-even' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal'), { lecturerId: 'dosen-lain', lecturer: 'Dosen Lain' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal-legacy'), { scheduleId: 'schedule-genap' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'sessions/session-terjadwal'), { extraField: true }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(even, 'sessions/session-ganjil')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDoc(doc(odd, 'attendances/session-ganjil_student-enrolled'))).exists()).toBe(true);
    expect((await getDoc(doc(odd, 'permits/session-ganjil_student-enrolled'))).exists()).toBe(true);
    expect((await getDoc(doc(odd, 'reviews/session-ditutup_student-enrolled'))).exists()).toBe(true);
    await expect(deleteDoc(doc(odd, 'sessions/session-ganjil')))
      .resolves.toBeUndefined();
    await expect(deleteDoc(doc(odd, 'sessions/session-ditutup')))
      .resolves.toBeUndefined();
    await expect(deleteDoc(doc(student, 'sessions/session-ganjil')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('limits enrollment reads and permits only valid assistant create-only enrollment', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const even = environment.authenticatedContext('asprak-even', {
      assistantSemesterParity: 'genap',
    }).firestore();
    const student = environment.authenticatedContext('student-enrolled').firestore();

    expect((await getDoc(doc(student, 'enrollments/class-ganjil_student-enrolled'))).exists()).toBe(true);
    expect((await getDoc(doc(student, 'enrollments/class-missing_student-enrolled'))).exists()).toBe(false);
    await expect(getDoc(doc(student, 'enrollments/class-genap_student-even')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(even, 'enrollments/class-genap_student-even-new'), {
      ...enrollmentRecord('student-even-new', 'Mahasiswa Genap Baru', '457', 2),
    })).resolves.toBeUndefined();
    await expect(getDocs(query(
      collection(student, 'enrollments'), where('praktikanId', '==', 'student-enrolled'),
    ))).resolves.toMatchObject({ size: 1 });
    await expect(getDocs(query(
      collection(odd, 'enrollments'), where('classId', '==', 'class-ganjil'),
    ))).resolves.toMatchObject({ size: 2 });
    await expect(getDocs(query(
      collection(odd, 'enrollments'), where('classId', '==', 'class-genap'),
    ))).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(setDoc(doc(odd, 'enrollments/class-ganjil_student-outside'), {
      ...enrollmentRecord('student-outside', 'Mahasiswa Luar', '789', 1),
    })).resolves.toBeUndefined();
    await expect(setDoc(doc(even, 'enrollments/class-ganjil_student-even'), {
      praktikanId: 'student-even', praktikanName: 'Mahasiswa Genap', studentCode: '456',
      classId: 'class-ganjil', courseId: 'course-1', semester: 1, createdAt: '2026-01-02',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'enrollments/class-ganjil_student-enrolled'), {
      ...enrollmentRecord('student-enrolled', 'Mahasiswa Terdaftar', '123', 1),
      createdAt: '2026-01-02',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'enrollments/class-ganjil_student-enrolled'), { semester: 3 }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(student, 'enrollments/class-ganjil_student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(even, 'enrollments/class-ganjil_student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(odd, 'enrollments/class-ganjil_student-enrolled')))
      .resolves.toBeUndefined();
  });

  it('allows only canonical attendance creates for enrolled students in active lab sessions', async () => {
    const student = environment.authenticatedContext('student-new').firestore();
    const outside = environment.authenticatedContext('student-outside').firestore();
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const attendance = attendanceRecord(
      'session-with-lab',
      'student-new',
      'Mahasiswa Baru',
    );

    await expect(getDoc(doc(outside, 'attendances/session-ganjil_student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'attendances/session-with-lab_student-new'), attendance))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(student, 'attendances/session-with-lab_student-new'), {
      attendedAt: serverTimestamp(),
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'attendances/session-ditutup_student-new'), {
      ...attendanceRecord('session-ditutup', 'student-new', 'Mahasiswa Baru'),
      laboratoryId: 'lab-b',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'attendances/session-legacy-iso_student-new'), {
      ...attendanceRecord('session-legacy-iso', 'student-new', 'Mahasiswa Baru'),
      laboratoryId: 'lab-b',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(outside, 'attendances/session-with-lab_student-outside'), {
      ...attendance, praktikanId: 'student-outside', praktikanName: 'Mahasiswa Luar',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'attendances/session-with-lab_student-new-tamper'), {
      ...attendance, praktikanName: 'Nama Palsu',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(student, 'attendances/session-with-lab_student-new'), { status: 'izin' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(odd, 'attendances/session-ganjil_student-enrolled')))
      .resolves.toBeUndefined();
  });

  it('allows laboratory reads for app roles and denies client laboratory writes', async () => {
    const student = environment.authenticatedContext('student-new').firestore();
    const assistant = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const outside = environment.authenticatedContext('student-outside').firestore();

    const laboratory = await getDoc(doc(student, 'laboratories/lab-b'));
    expect(laboratory.exists()).toBe(true);
    const assistantLaboratories = await getDocs(collection(assistant, 'laboratories'));
    expect(assistantLaboratories.size).toBe(2);
    await expect(getDoc(doc(environment.unauthenticatedContext().firestore(), 'laboratories/lab-b')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(outside, 'laboratories/lab-forged'), {
      name: 'Lab Palsu', latitude: 0, longitude: 0, radius: 500, lantai: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('scopes assistant attendance and permit queries to sessions owned by that assistant', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const enrolledStudent = environment.authenticatedContext('student-enrolled').firestore();
    const attendanceCollection = collection(odd, 'attendances');
    const permitsCollection = collection(odd, 'permits');

    await expect(getDocs(query(
      collection(enrolledStudent, 'attendances'),
      where('sessionId', '==', 'session-ganjil'),
      where('praktikanId', '==', 'student-enrolled'),
    ))).resolves.toMatchObject({ size: 1 });
    await expect(getDocs(query(
      collection(enrolledStudent, 'attendances'),
      where('sessionId', '==', 'session-ganjil'),
    ))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(query(attendanceCollection, where('sessionId', '==', 'session-ganjil'))))
      .resolves.toMatchObject({ size: 1 });
    await expect(getDocs(query(attendanceCollection, where('sessionId', '==', 'session-genap'))))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(query(permitsCollection, where('sessionId', '==', 'session-ganjil'))))
      .resolves.toMatchObject({ size: 1 });
    await expect(getDocs(query(permitsCollection, where('sessionId', '==', 'session-genap'))))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('requires a server timestamp on attendance creation', async () => {
    const student = environment.authenticatedContext('student-new').firestore();
    const attendanceRef = doc(student, 'attendances/session-with-lab_student-new');
    const now = Date.now();
    const attendance = attendanceRecord('session-with-lab', 'student-new', 'Mahasiswa Baru');

    await expect(setDoc(attendanceRef, {
      ...attendance, attendedAt: Timestamp.fromMillis(now - 1_000),
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(attendanceRef, attendance)).resolves.toBeUndefined();
  });

  it('denies attendance writes before the session starts and after it ends', async () => {
    const student = environment.authenticatedContext('student-new').firestore();
    const setSessionWindow = async (startsAt: Timestamp, endsAt: Timestamp) => {
      await environment.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), 'sessions/session-with-lab'),
          {
            ...sessionRecord('class-ganjil', 'asprak-odd', 1, 'dibuka', startsAt, endsAt),
            laboratoryId: 'lab-b',
          },
        );
      });
    };
    const attendanceRef = doc(student, 'attendances/session-with-lab_student-new');
    const attendance = attendanceRecord('session-with-lab', 'student-new', 'Mahasiswa Baru');
    const now = Date.now();

    await setSessionWindow(
      Timestamp.fromMillis(now + 60_000),
      Timestamp.fromMillis(now + 5 * 60_000),
    );
    await expect(setDoc(attendanceRef, attendance))
      .rejects.toMatchObject({ code: 'permission-denied' });

    await setSessionWindow(
      Timestamp.fromMillis(now - 5 * 60_000),
      Timestamp.fromMillis(now - 60_000),
    );
    await expect(setDoc(attendanceRef, attendance))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('scopes Spark QR issuance, reads, and attendance to the owning assistant and enrolled user', async () => {
    const assistant = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const student = environment.authenticatedContext('student-new').firestore();
    const outside = environment.authenticatedContext('student-outside').firestore();
    const token = 'Q'.repeat(43);
    const qrRef = doc(assistant, 'attendanceQrTokens/session-with-lab');
    const qr = {
      sessionId: 'session-with-lab',
      token,
      issuedBy: 'asprak-odd',
      issuedAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      revokedAt: null,
      revokedBy: null,
    };

    await expect(setDoc(qrRef, qr)).resolves.toBeUndefined();
    const qrSnapshot = await getDoc(doc(student, 'attendanceQrTokens/session-with-lab'));
    expect(qrSnapshot.exists()).toBe(true);
    await expect(setDoc(doc(student, 'attendances/session-with-lab_student-new'),
      attendanceRecord('session-with-lab', 'student-new', 'Mahasiswa Baru', 'qr', token)))
      .resolves.toBeUndefined();
    await expect(getDoc(doc(outside, 'attendanceQrTokens/session-with-lab')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(qrRef, {
      revokedAt: serverTimestamp(),
      revokedBy: 'asprak-odd',
    })).resolves.toBeUndefined();
    await expect(setDoc(doc(student, 'attendances/session-with-lab_student-outside'),
      attendanceRecord('session-with-lab', 'student-outside', 'Mahasiswa Luar', 'qr', token)))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('preserves permit workflow while binding review identity to the authenticated assistant', async () => {
    const student = environment.authenticatedContext('student-new').firestore();
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const even = environment.authenticatedContext('asprak-even', {
      assistantSemesterParity: 'genap',
    }).firestore();
    const permitRef = doc(student, 'permits/session-ganjil_student-new');

    await runTransaction(student, async (transaction) => {
      const missing = await transaction.get(permitRef);
      expect(missing.exists()).toBe(false);
      transaction.set(permitRef, permitRecord('session-ganjil', 'student-new', 'Mahasiswa Baru'));
    });
    expect((await getDoc(doc(student, 'permits/session-ganjil_student-new'))).exists()).toBe(true);
    await expect(updateDoc(doc(even, 'permits/session-ganjil_student-enrolled'), {
      status: 'approved', reviewedAt: '2026-01-02', reviewedBy: 'Asprak Genap',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(environment.authenticatedContext('student-outside').firestore(),
      'permits/session-ganjil_student-outside'),
    permitRecord('session-ganjil', 'student-outside', 'Mahasiswa Luar')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'permits/session-ganjil_student-enrolled'), {
      status: 'approved', reviewedAt: '2026-01-02', reviewedBy: 'Asprak Palsu',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(odd, 'permits/session-ganjil_student-enrolled'), {
      status: 'approved', reviewedAt: '2026-01-02', reviewedBy: 'Asprak Ganjil',
    })).resolves.toBeUndefined();
    await expect(setDoc(doc(environment.authenticatedContext('student-enrolled').firestore(),
      'permits/session-with-lab_student-enrolled'),
    permitRecord('session-with-lab', 'student-enrolled', 'Mahasiswa Terdaftar')))
      .resolves.toBeUndefined();
    await expect(deleteDoc(doc(odd, 'permits/session-ganjil_student-enrolled')))
      .resolves.toBeUndefined();
  });

  it('limits reviews and attendance archives to their owner or session owner', async () => {
    const student = environment.authenticatedContext('student-new').firestore();
    const enrolledStudent = environment.authenticatedContext('student-enrolled').firestore();
    const outside = environment.authenticatedContext('student-outside').firestore();
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const even = environment.authenticatedContext('asprak-even', {
      assistantSemesterParity: 'genap',
    }).firestore();

    expect((await getDoc(doc(enrolledStudent, 'reviews/session-ditutup_student-enrolled'))).exists()).toBe(true);
    await expect(getDoc(doc(outside, 'reviews/session-ditutup_student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'reviews/session-ganjil_student-new'),
      reviewRecord('session-ganjil', 'student-new', 'Mahasiswa Baru')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'reviews/session-ditutup-2_student-new'),
      reviewRecord('session-ditutup-2', 'student-new', 'Nama Palsu')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(outside, 'reviews/session-ditutup_student-outside'),
      reviewRecord('session-ditutup', 'student-outside', 'Mahasiswa Luar')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(student, 'reviews/session-ditutup_student-enrolled'), { comment: 'ubah' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(query(
      collection(odd, 'reviews'), where('sessionId', '==', 'session-ditutup'),
    ))).resolves.toMatchObject({ size: 1 });
    await expect(getDocs(query(
      collection(even, 'reviews'), where('sessionId', '==', 'session-ditutup'),
    ))).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await getDoc(doc(enrolledStudent, 'attendanceArchieve/archive-student-enrolled'))).exists()).toBe(true);
    await expect(getDoc(doc(odd, 'attendanceArchieve/archive-student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(student, 'attendanceArchieve/archive-student-enrolled')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'reviews/session-ditutup_student-new'),
      reviewRecord('session-ditutup', 'student-new', 'Mahasiswa Baru')))
      .resolves.toBeUndefined();
  });

  it('allows every signed-in user to read laboratories but only assistants to write', async () => {
    const student = environment.authenticatedContext('student-enrolled').firestore();
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();
    const unauthenticated = environment.unauthenticatedContext().firestore();

    expect((await getDoc(doc(student, 'laboratories/lab-b'))).exists()).toBe(true);
    expect((await getDocs(collection(student, 'laboratories'))).size).toBe(2);
    expect((await getDoc(doc(odd, 'laboratories/lab-c'))).exists()).toBe(true);
    // Collection reads are allowed for any signed-in user because a list query
    // cannot apply per-document field validation without denying the whole query.
    expect((await getDocs(collection(odd, 'laboratories'))).size).toBe(2);
    await expect(getDoc(doc(unauthenticated, 'laboratories/lab-b')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(collection(unauthenticated, 'laboratories')))
      .rejects.toMatchObject({ code: 'permission-denied' });

    await expect(setDoc(doc(student, 'laboratories/lab-student'), laboratoryRecord('Laboratorium Siswa')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(student, 'laboratories/lab-b'), { radius: 100 }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-odd'), laboratoryRecord('Laboratorium Ganjil')))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'laboratories/lab-b'), { radius: 150 }))
      .resolves.toBeUndefined();
  });

  it('rejects laboratory writes that break the attribute contract', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();

    await expect(setDoc(doc(odd, 'laboratories/lab-radius-0'),
      laboratoryRecord('Lab Radius Nol', { radius: 0 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-radius-700'),
      laboratoryRecord('Lab Radius Besar', { radius: 700 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-radius-fraction'),
      laboratoryRecord('Lab Radius Pecahan', { radius: 12.5 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-lat'),
      laboratoryRecord('Lab Latitude', { latitude: 90.5 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-lng'),
      laboratoryRecord('Lab Longitude', { longitude: -180.5 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-lantai'),
      laboratoryRecord('Lab Lantai', { lantai: 0 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-extra'),
      laboratoryRecord('Lab Ekstra', { kapasitas: 30 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-lantai-tinggi'),
      laboratoryRecord('Lab Lantai Tinggi', { lantai: 7 })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'laboratories/lab-status-invalid'),
      laboratoryRecord('Lab Status Salah', { isActive: 'ya' })))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(odd, 'laboratories/lab-b')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('lets assistants deactivate and reactivate a laboratory', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();

    await expect(setDoc(doc(odd, 'laboratories/lab-toggle'),
      laboratoryRecord('Lab Toggle', { isActive: false })))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'laboratories/lab-toggle'), { isActive: true }))
      .resolves.toBeUndefined();

    // Documents written before the activation feature keep working without the
    // field, because a missing isActive is treated as active.
    const legacy = laboratoryRecord('Lab Lama');
    delete (legacy as Record<string, unknown>).isActive;
    await expect(setDoc(doc(odd, 'laboratories/lab-legacy'), legacy))
      .resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'laboratories/lab-legacy'), { radius: 200 }))
      .resolves.toBeUndefined();
  });

  it('accepts laboratoryId on sessions only when the laboratory exists', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();

    expect((await getDoc(doc(odd, 'sessions/session-with-lab'))).exists()).toBe(true);
    await expect(setDoc(doc(odd, 'sessions/session-lab-missing'), {
      ...sessionRecord('class-ganjil', 'asprak-odd', 1),
      laboratoryId: 'lab-tidak-ada',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'sessions/session-lab-valid'), {
      ...sessionRecord('class-ganjil', 'asprak-odd', 1, 'terjadwal'),
      startsAt: Timestamp.fromMillis(Date.now()),
      endsAt: Timestamp.fromMillis(Date.now() + 3_600_000),
      laboratoryId: 'lab-b',
    })).resolves.toBeUndefined();
  });

  it('allows editing sessions that still reference an inactive laboratory', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();

    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'laboratories/lab-b'), { isActive: false });
    });

    const changes = {
      startsAt: Timestamp.fromMillis(Date.now() + 60_000),
      endsAt: Timestamp.fromMillis(Date.now() + 3_660_000),
    };

    await expect(updateDoc(doc(odd, 'sessions/session-with-lab'), {
      ...changes,
      laboratoryId: 'lab-b',
    })).resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'sessions/session-with-lab'), {
      ...changes,
      laboratoryId: 'lab-c',
    })).resolves.toBeUndefined();
  });

  it('accepts scheduleId on sessions only when the schedule exists', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();

    await expect(setDoc(doc(odd, 'sessions/session-schedule-missing'), {
      ...sessionRecord('class-ganjil', 'asprak-odd', 1),
      scheduleId: 'schedule-tidak-ada',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(odd, 'sessions/session-schedule-valid'), {
      ...sessionRecord('class-ganjil', 'asprak-odd', 1, 'terjadwal'),
      startsAt: Timestamp.fromMillis(Date.now()),
      endsAt: Timestamp.fromMillis(Date.now() + 3_600_000),
      scheduleId: 'schedule-ganjil',
    })).resolves.toBeUndefined();
  });

  it('allows editing sessions that still reference an inactive laboratory', async () => {
    const odd = environment.authenticatedContext('asprak-odd', {
      assistantSemesterParity: 'ganjil',
    }).firestore();

    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'laboratories/lab-b'), { isActive: false });
    });

    const changes = {
      startsAt: Timestamp.fromMillis(Date.now() + 60_000),
      endsAt: Timestamp.fromMillis(Date.now() + 3_660_000),
    };

    await expect(updateDoc(doc(odd, 'sessions/session-with-lab'), {
      ...changes,
      laboratoryId: 'lab-b',
    })).resolves.toBeUndefined();
    await expect(updateDoc(doc(odd, 'sessions/session-with-lab'), {
      ...changes,
      laboratoryId: 'lab-c',
    })).resolves.toBeUndefined();
  });
});
