import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let environment: RulesTestEnvironment;

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  environment = await initializeTestEnvironment({
    projectId: 'demo-tandaiu-containment',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(join(process.cwd(), 'firestore.containment.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  if (!environment) return;
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, 'users/student-1'), {
        role: 'praktikan', name: 'Student', email: 'student@example.test',
      }),
      setDoc(doc(database, 'sessions/session-1'), { status: 'dibuka' }),
      setDoc(doc(database, 'attendances/session-1_student-1'), {
        sessionId: 'session-1', praktikanId: 'student-1',
      }),
    ]);
  });
});

afterAll(async () => {
  await environment?.cleanup();
});

describeWithEmulator('Emergency containment Firestore Rules', () => {
  it('allows only an authenticated user to get their own profile', async () => {
    const owner = environment.authenticatedContext('student-1').firestore();
    const other = environment.authenticatedContext('student-2').firestore();
    const anonymous = environment.unauthenticatedContext().firestore();

    expect((await getDoc(doc(owner, 'users/student-1'))).exists()).toBe(true);
    await expect(getDoc(doc(other, 'users/student-1')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDoc(doc(anonymous, 'users/student-1')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(collection(owner, 'users')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('blocks self-promotion and every client write during containment', async () => {
    const student = environment.authenticatedContext('student-1').firestore();
    const newUser = environment.authenticatedContext('new-user').firestore();

    await expect(setDoc(doc(newUser, 'users/new-user'), {
      role: 'asisten', name: 'Promoted', email: 'new@example.test',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(newUser, 'users/new-user'), {
      role: 'praktikan', name: 'New', email: 'new@example.test',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(student, 'users/student-1'), { name: 'Changed' }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(student, 'attendances/session-1_student-1'), {
      sessionId: 'session-1', praktikanId: 'student-1',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(doc(student, 'sessions/session-1')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('denies access to all application data during containment', async () => {
    const assistant = environment.authenticatedContext('asprak-1', {
      assistantSemesterParity: 'ganjil',
    }).firestore();

    await expect(getDoc(doc(assistant, 'sessions/session-1')))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDocs(collection(assistant, 'attendances')))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });
});
