import { getDocs, runTransaction, updateDoc } from 'firebase/firestore';

import {
  buildClassKey,
  ensureClassesForSessions,
  migrateClassesAndSessions,
} from '../migrations/classesSessions';
import {
  buildEnrollmentAccountMap,
  buildEnrollmentDocument,
  buildEnrollmentId,
  buildEnrollmentPlan,
  createMissingEnrollments,
  verifyEnrollments,
} from '../migrations/enrollments';
import type { EnrollmentPlan } from '../migrations/types';
import { praktikans } from '../data/praktikans';
import type { ClassDoc } from '../types/praktikum';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ path: 'mock-collection' })),
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  getDocs: jest.fn(),
  runTransaction: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({ db: {} }));

const database = {} as never;

const sem3Class: ClassDoc = {
  id: 'class-sem3',
  courseId: 'struktur-data',
  className: 'A1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const sem4Class: ClassDoc = {
  id: 'class-sem4',
  courseId: 'pemrograman-berorientasi-objek',
  className: 'B1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const allStudentCodes = praktikans
  .map((praktikan) => praktikan.studentCode)
  .filter((studentCode): studentCode is string => Boolean(studentCode));

const allUids = new Map(
  allStudentCodes.map((studentCode, index) => [studentCode, `uid-${index + 1}`]),
);

const singlePlan: EnrollmentPlan = {
  expectedCount: 1,
  items: [
    {
      id: 'class-sem3_uid-1',
      praktikanId: 'uid-1',
      praktikanName: 'Andi Pratama',
      studentCode: '24060124120001',
      classId: 'class-sem3',
      courseId: 'struktur-data',
      semester: 3,
    },
  ],
  missingStudentCodes: [],
  unresolvedClassIds: [],
  duplicateClassIds: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildClassKey', () => {
  it('trims course and class names before building the key', () => {
    expect(buildClassKey(' struktur-data ', ' A1 ')).toBe(
      buildClassKey('struktur-data', 'A1'),
    );
    expect(buildClassKey('struktur-data', 'A1')).not.toBe(
      buildClassKey('basis-data', 'A1'),
    );
  });
});

describe('ensureClassesForSessions', () => {
  it('rejects client writes that cannot attach trusted assistant metadata', async () => {
    await expect(ensureClassesForSessions(
      [{ courseId: 'struktur-data', className: 'A1' }],
      database,
    )).rejects.toThrow('Penulisan migrasi kelas dinonaktifkan');
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('plans a missing class without writing during dry-run', async () => {
    jest.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

    const result = await ensureClassesForSessions(
      [{ courseId: 'struktur-data', className: 'A1' }],
      database,
      { dryRun: true },
    );

    expect(result.created).toBe(1);
    expect(runTransaction).not.toHaveBeenCalled();
  });
});

describe('migrateClassesAndSessions dry-run', () => {
  it('does not create classes or update sessions', async () => {
    const sessionDocument = {
      id: 's1',
      data: () => ({
        courseId: 'struktur-data',
        className: 'A1',
        status: 'dibuka',
      }),
    };
    jest.mocked(getDocs).mockResolvedValueOnce({
      docs: [sessionDocument],
    } as never);
    jest.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

    const result = await migrateClassesAndSessions(database, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.classesCreated).toBeGreaterThan(0);
    expect(result.sessionsUpdated).toBe(1);
    expect(runTransaction).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('buildEnrollmentAccountMap', () => {
  it('maps valid studentCode to Firebase Auth UID', () => {
    const result = buildEnrollmentAccountMap([
      { uid: 'uid-auth-1', studentCode: '24060124120001' },
    ]);

    expect(result.summary.mapped).toBe(1);
    expect(result.uidByStudentCode.get('24060124120001')).toBe('uid-auth-1');
  });

  it('rejects local demo IDs and empty values', () => {
    const result = buildEnrollmentAccountMap([
      { uid: 'p1', studentCode: '24060124120001' },
      { uid: '', studentCode: '24060124120002' },
    ]);

    expect(result.summary.mapped).toBe(0);
    expect(result.summary.ignored).toHaveLength(2);
    expect(result.uidByStudentCode.size).toBe(0);
  });

  it('drops ambiguous studentCode and UID mappings', () => {
    const result = buildEnrollmentAccountMap([
      { uid: 'uid-a', studentCode: '111' },
      { uid: 'uid-b', studentCode: '111' },
      { uid: 'uid-c', studentCode: '222' },
      { uid: 'uid-c', studentCode: '333' },
    ]);

    expect(result.uidByStudentCode.has('111')).toBe(false);
    expect(result.uidByStudentCode.has('222')).toBe(false);
    expect(result.uidByStudentCode.has('333')).toBe(false);
    expect(result.summary.duplicateStudentCodes).toHaveLength(1);
    expect(result.summary.duplicateUids).toHaveLength(1);
  });
});

describe('buildEnrollmentPlan', () => {
  it('creates one enrollment per class and matching-semester praktikan', () => {
    const plan = buildEnrollmentPlan([sem3Class, sem4Class], allUids);

    expect(plan.expectedCount).toBe(12);
    expect(plan.items).toHaveLength(12);
    expect(plan.missingStudentCodes).toEqual([]);
    expect(plan.items.every((item) => item.id === `${item.classId}_${item.praktikanId}`))
      .toBe(true);
  });

  it('reports student codes without a valid UID instead of inventing one', () => {
    const known = new Map([
      ['24060124120001', 'uid-sem3'],
      ['24060124120006', 'uid-sem4'],
    ]);

    const plan = buildEnrollmentPlan([sem3Class, sem4Class], known);

    expect(plan.expectedCount).toBe(12);
    expect(plan.items).toHaveLength(2);
    expect(plan.missingStudentCodes).toHaveLength(10);
    expect(plan.items.map((item) => item.praktikanId).sort()).toEqual([
      'uid-sem3',
      'uid-sem4',
    ]);
  });

  it('uses one canonical class when Firestore has duplicates', () => {
    const duplicate: ClassDoc = {
      ...sem3Class,
      id: 'class-sem3-duplicate',
      createdAt: '2026-02-01T00:00:00.000Z',
    };

    const plan = buildEnrollmentPlan([sem3Class, duplicate, sem4Class], allUids);

    expect(plan.duplicateClassIds).toEqual(['class-sem3-duplicate']);
    expect(plan.expectedCount).toBe(12);
    expect(plan.items).toHaveLength(12);
  });

  it('reports classes whose courseId is not in local courses', () => {
    const unknown: ClassDoc = {
      id: 'class-unknown',
      courseId: 'mata-kuliah-tidak-dikenal',
      className: 'X1',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const plan = buildEnrollmentPlan([sem3Class, unknown], new Map());

    expect(plan.unresolvedClassIds).toEqual(['class-unknown']);
    expect(plan.expectedCount).toBe(9);
  });
});

describe('enrollment documents', () => {
  it('builds a deterministic document id and payload', () => {
    expect(buildEnrollmentId('class-sem3', 'uid-1')).toBe('class-sem3_uid-1');

    expect(
      buildEnrollmentDocument(singlePlan.items[0], '2026-11-17T00:00:00.000Z'),
    ).toEqual({
      praktikanId: 'uid-1',
      praktikanName: 'Andi Pratama',
      studentCode: '24060124120001',
      classId: 'class-sem3',
      courseId: 'struktur-data',
      semester: 3,
      createdAt: '2026-11-17T00:00:00.000Z',
    });
  });
});

describe('verifyEnrollments', () => {
  it('reports valid class, course, semester, UID, and document id relations', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      size: 1,
      docs: [
        {
          id: 'class-sem3_uid-1',
          data: () => ({
            praktikanId: 'uid-1',
            studentCode: '24060124120001',
            classId: 'class-sem3',
            courseId: 'struktur-data',
            semester: 3,
          }),
        },
      ],
    } as never);

    const result = await verifyEnrollments(
      database,
      [sem3Class],
      new Map([['24060124120001', 'uid-1']]),
    );

    expect(result.count).toBe(1);
    result.checks.forEach((check) => {
      expect(check.broken).toEqual([]);
      expect(check.valid).toBe(1);
    });
  });

  it('flags mismatched course, semester, UID, and document id', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      size: 1,
      docs: [
        {
          id: 'wrong-id',
          data: () => ({
            praktikanId: 'uid-unknown',
            studentCode: '24060124120001',
            classId: 'class-sem3',
            courseId: 'basis-data',
            semester: 4,
          }),
        },
      ],
    } as never);

    const result = await verifyEnrollments(
      database,
      [sem3Class],
      new Map([['24060124120001', 'uid-1']]),
    );

    const brokenNames = result.checks
      .filter((check) => check.broken.length > 0)
      .map((check) => check.name);

    expect(brokenNames).toEqual(
      expect.arrayContaining([
        'enrollments-course',
        'enrollments-semester',
        'enrollments-praktikan',
        'enrollments-documentId',
      ]),
    );
  });
});

describe('createMissingEnrollments', () => {
  it('skips an existing enrollment without overwriting it', async () => {
    const set = jest.fn();
    jest.mocked(runTransaction).mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => true }),
        set,
      } as never),
    );

    const result = await createMissingEnrollments(singlePlan, { database });

    expect(result.created).toBe(0);
    expect(result.skippedExisting).toBe(1);
    expect(result.notAttempted).toBe(0);
    expect(set).not.toHaveBeenCalled();
  });

  it('creates a missing enrollment inside the transaction', async () => {
    const set = jest.fn();
    jest.mocked(runTransaction).mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => false }),
        set,
      } as never),
    );

    const result = await createMissingEnrollments(singlePlan, {
      database,
      createdAt: '2026-11-17T00:00:00.000Z',
    });

    expect(result.created).toBe(1);
    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        praktikanId: 'uid-1',
        classId: 'class-sem3',
      }),
    );
  });

  it('reports permission-denied as blocked and never retries every document', async () => {
    jest.mocked(runTransaction).mockRejectedValue({ code: 'permission-denied' });

    const result = await createMissingEnrollments(singlePlan, { database });

    expect(result.created).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.notAttempted).toBe(1);
    expect(result.blockedReason).toContain('permission-denied');
    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not write during a dry run', async () => {
    const result = await createMissingEnrollments(singlePlan, {
      database,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.notAttempted).toBe(1);
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
