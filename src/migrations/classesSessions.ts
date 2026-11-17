import {
  collection,
  doc,
  getDocs,
  runTransaction,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { initialSessions } from '../data/sessions';
import type { PracticumSession } from '../types';
import { COLLECTIONS, type ClassDoc } from '../types/praktikum';
import {
  getDefaultDatabase,
  readCollectionDocuments,
  stringValue,
} from './shared';
import type { ClassSessionMigrationResult } from './types';

export type InitialClassSeedResult = {
  classByKey: Map<string, ClassDoc>;
  classById: Map<string, ClassDoc>;
  created: number;
  reused: number;
  duplicateClasses: string[];
};

type ClassPairInput = Pick<PracticumSession, 'courseId' | 'className'>;

type SessionRecord = {
  id: string;
  courseId: string;
  className: string;
  classId: string;
};

export function buildClassKey(courseId: string, className: string): string {
  return `${courseId.trim()}\u0000${className.trim()}`;
}

function classLabel(courseId: string, className: string): string {
  return `${courseId.trim()} / ${className.trim()}`;
}

/**
 * Deterministic document ID so two migration runs cannot create two classes for
 * the same course/class pair. Existing classes with auto IDs are still reused
 * by the courseId/className key.
 */
export function buildClassDocumentId(courseId: string, className: string): string {
  return `${encodeURIComponent(courseId.trim())}::${encodeURIComponent(className.trim())}`;
}

function toClassDoc(id: string, data: DocumentData): ClassDoc | null {
  const courseId = stringValue(data.courseId);
  const className = stringValue(data.className);
  if (!courseId || !className) {
    return null;
  }

  return {
    id,
    courseId,
    className,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
  };
}

export async function readClassDocs(
  database: Firestore = getDefaultDatabase(),
): Promise<ClassDoc[]> {
  const snapshot = await getDocs(collection(database, COLLECTIONS.classes));

  return snapshot.docs
    .map((document) => toClassDoc(document.id, document.data()))
    .filter((item): item is ClassDoc => item !== null)
    .sort((a, b) => {
      const created = a.createdAt.localeCompare(b.createdAt);
      return created !== 0 ? created : a.id.localeCompare(b.id);
    });
}

function indexClasses(classes: ClassDoc[]): {
  classByKey: Map<string, ClassDoc>;
  classById: Map<string, ClassDoc>;
  duplicateClasses: string[];
} {
  const classByKey = new Map<string, ClassDoc>();
  const classById = new Map<string, ClassDoc>();
  const duplicateClasses = new Set<string>();

  classes.forEach((classDoc) => {
    classById.set(classDoc.id, classDoc);
    const key = buildClassKey(classDoc.courseId, classDoc.className);
    if (classByKey.has(key)) {
      duplicateClasses.add(classLabel(classDoc.courseId, classDoc.className));
      return;
    }
    classByKey.set(key, classDoc);
  });

  return { classByKey, classById, duplicateClasses: [...duplicateClasses] };
}

function uniquePairs(sessions: readonly ClassPairInput[]): Map<string, ClassPairInput> {
  const pairs = new Map<string, ClassPairInput>();

  sessions.forEach((session) => {
    const courseId = stringValue(session.courseId);
    const className = stringValue(session.className);
    if (!courseId || !className) return;
    pairs.set(buildClassKey(courseId, className), { courseId, className });
  });

  return pairs;
}

export type ClassMigrationOptions = {
  dryRun?: boolean;
};

/**
 * Membuat kelas yang belum ada untuk pasangan courseId/className. Data yang
 * sudah ada tidak diubah atau dihapus, dan ID dokumen baru deterministik.
 * Saat `dryRun`, kelas yang seharusnya dibuat hanya dihitung di memori.
 */
export async function ensureClassesForSessions(
  sessions: readonly ClassPairInput[],
  database: Firestore = getDefaultDatabase(),
  options: ClassMigrationOptions = {},
): Promise<InitialClassSeedResult> {
  const existingClasses = await readClassDocs(database);
  const { classByKey, classById, duplicateClasses } = indexClasses(existingClasses);
  const requested = uniquePairs(sessions);

  let reused = 0;
  requested.forEach((_pair, key) => {
    if (classByKey.has(key)) reused += 1;
  });

  let created = 0;
  const createdAt = new Date().toISOString();

  for (const [key, pair] of requested) {
    if (classByKey.has(key)) continue;

    const classDoc: ClassDoc = {
      id: buildClassDocumentId(pair.courseId, pair.className),
      courseId: pair.courseId,
      className: pair.className,
      createdAt,
    };

    if (options.dryRun) {
      created += 1;
      classByKey.set(key, classDoc);
      classById.set(classDoc.id, classDoc);
      continue;
    }

    const reference = doc(
      database,
      COLLECTIONS.classes,
      buildClassDocumentId(pair.courseId, pair.className),
    );
    const outcome = await runTransaction(database, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists()) {
        return null;
      }

      transaction.set(reference, {
        courseId: pair.courseId,
        className: pair.className,
        createdAt,
      });
      return reference.id;
    });

    if (outcome === null) {
      reused += 1;
    } else {
      created += 1;
    }

    classByKey.set(key, classDoc);
    classById.set(classDoc.id, classDoc);
  }

  return {
    classByKey,
    classById,
    created,
    reused,
    duplicateClasses,
  };
}

export async function ensureClassesForInitialSessions(
  sessions: PracticumSession[] = initialSessions,
  database: Firestore = getDefaultDatabase(),
): Promise<InitialClassSeedResult> {
  return ensureClassesForSessions(sessions, database);
}

function readSessionRecords(read: Awaited<ReturnType<typeof readCollectionDocuments>>): {
  records: SessionRecord[];
  invalid: string[];
} {
  const records: SessionRecord[] = [];
  const invalid: string[] = [];

  read.docs.forEach((document) => {
    const courseId = stringValue(document.data.courseId);
    const className = stringValue(document.data.className);
    if (!courseId || !className) {
      invalid.push(document.id);
      return;
    }

    records.push({
      id: document.id,
      courseId,
      className,
      classId: stringValue(document.data.classId),
    });
  });

  return { records, invalid };
}

/**
 * Migrasi classes dan relasi sessions.classId. Sesi yang sudah punya classId
 * valid tidak disentuh. Sesi dengan classId tidak valid dilaporkan, bukan
 * ditimpa, agar keputusan pemilik data tetap dipertahankan.
 */
export async function migrateClassesAndSessions(
  database: Firestore = getDefaultDatabase(),
  options: ClassMigrationOptions = {},
): Promise<ClassSessionMigrationResult> {
  const sessionRead = await readCollectionDocuments(database, COLLECTIONS.sessions);
  if (sessionRead.error) {
    throw new Error(sessionRead.error);
  }

  const { records, invalid } = readSessionRecords(sessionRead);
  const sessionIds = new Set(sessionRead.docs.map((document) => document.id));
  const pairs: ClassPairInput[] = [
    ...initialSessions.map((session) => ({
      courseId: session.courseId,
      className: session.className,
    })),
    ...records.map((record) => ({
      courseId: record.courseId,
      className: record.className,
    })),
  ];

  // Classes are created from the seed sessions and from every existing session,
  // so sessions created through CRUD also get a class relation.
  const classSeed = await ensureClassesForSessions(pairs, database, {
    dryRun: options.dryRun,
  });

  let sessionsUpdated = 0;
  let sessionsAlreadyMigrated = 0;
  const sessionsWithoutMatchingClass: string[] = [];
  const invalidExistingClassIds: string[] = [];

  for (const record of records) {
    const sourceClass = classSeed.classById.get(record.classId);

    if (record.classId) {
      if (
        sourceClass &&
        sourceClass.courseId === record.courseId &&
        sourceClass.className === record.className
      ) {
        sessionsAlreadyMigrated += 1;
      } else {
        invalidExistingClassIds.push(record.id);
      }
      continue;
    }

    const matchingClass = classSeed.classByKey.get(
      buildClassKey(record.courseId, record.className),
    );
    if (!matchingClass) {
      sessionsWithoutMatchingClass.push(record.id);
      continue;
    }

    if (options.dryRun) {
      sessionsUpdated += 1;
      continue;
    }

    await updateDoc(doc(database, COLLECTIONS.sessions, record.id), {
      classId: matchingClass.id,
    });
    sessionsUpdated += 1;
  }

  const finalClasses = await readClassDocs(database);
  const finalClassById = new Map(finalClasses.map((classDoc) => [classDoc.id, classDoc]));
  const finalSessions = await readCollectionDocuments(database, COLLECTIONS.sessions);
  if (finalSessions.error) {
    throw new Error(finalSessions.error);
  }

  const sessionsWithoutClassId: string[] = [];
  const invalidClassReferences: string[] = [];
  let sessionsWithClassId = 0;
  let validClassReferences = 0;

  finalSessions.docs.forEach((document) => {
    const classId = stringValue(document.data.classId);
    if (!classId) {
      sessionsWithoutClassId.push(document.id);
      return;
    }

    sessionsWithClassId += 1;
    const classDoc = finalClassById.get(classId);
    const courseId = stringValue(document.data.courseId);
    const className = stringValue(document.data.className);
    if (!classDoc || classDoc.courseId !== courseId || classDoc.className !== className) {
      invalidClassReferences.push(document.id);
      return;
    }

    validClassReferences += 1;
  });

  return {
    dryRun: options.dryRun ?? false,
    classesCreated: classSeed.created,
    classesReused: classSeed.reused,
    duplicateClasses: classSeed.duplicateClasses,
    sessionsUpdated,
    sessionsAlreadyMigrated,
    sessionsMissing: initialSessions
      .filter((session) => !sessionIds.has(session.id))
      .map((session) => session.id),
    sessionsWithoutMatchingClass,
    sessionsInvalid: invalid,
    invalidExistingClassIds,
    verification: {
      sessionsWithClassId,
      validClassReferences,
      invalidClassReferences,
      sessionsWithoutClassId,
    },
  };
}
