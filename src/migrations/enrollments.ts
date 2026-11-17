import {
  doc,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';

import { courses } from '../data/courses';
import { praktikans } from '../data/praktikans';
import type { Semester } from '../types';
import type { ClassDoc } from '../types/praktikum';
import { buildClassKey } from './classesSessions';
import {
  describeFirestoreError,
  firestoreErrorCode,
  getDefaultDatabase,
  readCollectionDocuments,
  stringValue,
} from './shared';
import type {
  EnrollmentAccount,
  EnrollmentAccountMap,
  EnrollmentPlan,
  EnrollmentPlanItem,
  EnrollmentWriteResult,
  RelationCheck,
} from './types';

export const ENROLLMENTS_COLLECTION = 'enrollments';

const courseSemester = new Map<string, Semester>(
  courses.map((course) => [course.id, course.semester]),
);

export type EnrollmentDocument = {
  praktikanId: string;
  praktikanName: string;
  studentCode: string;
  classId: string;
  courseId: string;
  semester: Semester;
  createdAt: string;
};

export type CreateEnrollmentOptions = {
  database?: Firestore;
  createdAt?: string;
  dryRun?: boolean;
};

export type EnrollmentVerification = {
  count: number | null;
  error?: string;
  checks: RelationCheck[];
};

export function buildEnrollmentId(classId: string, praktikanId: string): string {
  return `${classId.trim()}_${praktikanId.trim()}`;
}

/**
 * UID harus berasal dari Firebase Auth. ID demo lokal `p1..p31` ditolak agar
 * tidak pernah tersimpan sebagai praktikanId di Firestore.
 */
export function isLocalDemoId(uid: string): boolean {
  return /^p\d+$/i.test(uid);
}

/**
 * Mapping hanya berisi pasangan yang tidak ambigu. Kode mahasiswa dengan dua
 * UID, atau UID dengan dua kode mahasiswa, dikeluarkan dan dilaporkan agar
 * enrollment tidak menautkan akun yang salah.
 */
export function buildEnrollmentAccountMap(
  accounts: EnrollmentAccount[],
): EnrollmentAccountMap {
  const uidsByStudentCode = new Map<string, Set<string>>();
  const studentCodesByUid = new Map<string, Set<string>>();
  const ignored: { value: string; reason: string }[] = [];

  accounts.forEach((account) => {
    const uid = stringValue(account.uid);
    const studentCode = stringValue(account.studentCode);

    if (!uid || !studentCode) {
      ignored.push({
        value: `${studentCode || '<studentCode-kosong>'}:${uid || '<uid-kosong>'}`,
        reason: 'UID atau studentCode kosong.',
      });
      return;
    }

    if (isLocalDemoId(uid)) {
      ignored.push({
        value: `${studentCode}:${uid}`,
        reason: 'UID ID demo lokal (p1..p31), bukan Firebase Auth UID.',
      });
      return;
    }

    if (!uidsByStudentCode.has(studentCode)) {
      uidsByStudentCode.set(studentCode, new Set());
    }
    uidsByStudentCode.get(studentCode)?.add(uid);

    if (!studentCodesByUid.has(uid)) {
      studentCodesByUid.set(uid, new Set());
    }
    studentCodesByUid.get(uid)?.add(studentCode);
  });

  const duplicateStudentCodes = [...uidsByStudentCode.entries()]
    .filter(([, uids]) => uids.size > 1)
    .map(([studentCode, uids]) => ({
      studentCode,
      uids: [...uids].sort(),
    }))
    .sort((a, b) => a.studentCode.localeCompare(b.studentCode));

  const duplicateUids = [...studentCodesByUid.entries()]
    .filter(([, studentCodes]) => studentCodes.size > 1)
    .map(([uid, studentCodes]) => ({
      uid,
      studentCodes: [...studentCodes].sort(),
    }))
    .sort((a, b) => a.uid.localeCompare(b.uid));

  const ambiguousUids = new Set(duplicateUids.map((entry) => entry.uid));
  const uidByStudentCode = new Map<string, string>();

  uidsByStudentCode.forEach((uids, studentCode) => {
    if (uids.size !== 1) return;
    const uid = [...uids][0];
    if (ambiguousUids.has(uid)) return;
    uidByStudentCode.set(studentCode, uid);
  });

  return {
    uidByStudentCode,
    summary: {
      accounts: accounts.length,
      mapped: uidByStudentCode.size,
      duplicateStudentCodes,
      duplicateUids,
      ignored,
    },
  };
}

/**
 * Enrollment diturunkan dari aturan demo yang sudah dipakai aplikasi:
 * praktikan terdaftar pada kelas yang mata kuliahnya sesuai semester praktikan.
 * Hanya kelas kanonik (satu per courseId/className) yang dipakai.
 */
export function buildEnrollmentPlan(
  classDocs: ClassDoc[],
  uidByStudentCode: ReadonlyMap<string, string> = new Map(),
): EnrollmentPlan {
  const canonicalByKey = new Map<string, ClassDoc>();
  const duplicateClassIds: string[] = [];

  [...classDocs]
    .sort((a, b) => {
      const created = a.createdAt.localeCompare(b.createdAt);
      return created !== 0 ? created : a.id.localeCompare(b.id);
    })
    .forEach((classDoc) => {
      const key = buildClassKey(classDoc.courseId, classDoc.className);
      if (canonicalByKey.has(key)) {
        duplicateClassIds.push(classDoc.id);
        return;
      }
      canonicalByKey.set(key, classDoc);
    });

  const items: EnrollmentPlanItem[] = [];
  const itemIds = new Set<string>();
  const countedPairs = new Set<string>();
  const missingStudentCodes = new Set<string>();
  const unresolvedClassIds: string[] = [];
  let expectedCount = 0;

  canonicalByKey.forEach((classDoc) => {
    const semester = courseSemester.get(classDoc.courseId);
    if (semester === undefined) {
      unresolvedClassIds.push(classDoc.id);
      return;
    }

    praktikans
      .filter((praktikan) => praktikan.semester === semester)
      .forEach((praktikan) => {
        const registeredStudentCode = stringValue(praktikan.studentCode);
        const studentCode = registeredStudentCode || praktikan.id;
        const pairKey = `${classDoc.id}\u0000${studentCode}`;
        if (countedPairs.has(pairKey)) return;

        countedPairs.add(pairKey);
        expectedCount += 1;

        const uid = registeredStudentCode
          ? uidByStudentCode.get(registeredStudentCode)
          : undefined;
        if (!uid) {
          missingStudentCodes.add(studentCode);
          return;
        }

        const id = buildEnrollmentId(classDoc.id, uid);
        if (itemIds.has(id)) return;

        itemIds.add(id);
        items.push({
          id,
          praktikanId: uid,
          praktikanName: praktikan.name,
          studentCode,
          classId: classDoc.id,
          courseId: classDoc.courseId,
          semester,
        });
      });
  });

  return {
    expectedCount,
    items,
    missingStudentCodes: [...missingStudentCodes].sort(),
    unresolvedClassIds: unresolvedClassIds.sort(),
    duplicateClassIds: [...new Set(duplicateClassIds)].sort(),
  };
}

export function buildEnrollmentDocument(
  item: EnrollmentPlanItem,
  createdAt: string,
): EnrollmentDocument {
  return {
    praktikanId: item.praktikanId,
    praktikanName: item.praktikanName,
    studentCode: item.studentCode,
    classId: item.classId,
    courseId: item.courseId,
    semester: item.semester,
    createdAt,
  };
}

/**
 * Hanya menulis enrollment yang belum ada. Transaksi membaca dokumen dengan ID
 * deterministik lebih dulu, sehingga data yang sudah ada tidak ditimpa.
 * permission-denied dihentikan sekali dan dilaporkan sebagai blocked.
 */
export async function createMissingEnrollments(
  plan: EnrollmentPlan,
  options: CreateEnrollmentOptions = {},
): Promise<EnrollmentWriteResult> {
  const database = options.database ?? getDefaultDatabase();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const result: EnrollmentWriteResult = {
    planned: plan.items.length,
    created: 0,
    skippedExisting: 0,
    failed: 0,
    notAttempted: 0,
    dryRun: options.dryRun ?? false,
    createdIds: [],
    skippedIds: [],
    failedIds: [],
  };

  if (result.dryRun) {
    result.notAttempted = plan.items.length;
    return result;
  }

  for (const item of plan.items) {
    const reference = doc(database, ENROLLMENTS_COLLECTION, item.id);

    try {
      const outcome = await runTransaction(database, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists()) {
          return 'skipped' as const;
        }

        transaction.set(reference, buildEnrollmentDocument(item, createdAt));
        return 'created' as const;
      });

      if (outcome === 'created') {
        result.created += 1;
        result.createdIds.push(item.id);
      } else {
        result.skippedExisting += 1;
        result.skippedIds.push(item.id);
      }
    } catch (error) {
      const code = firestoreErrorCode(error);
      if (
        code === 'permission-denied' ||
        code === 'unavailable' ||
        code === 'deadline-exceeded' ||
        code === 'network-request-failed'
      ) {
        result.blockedReason = describeFirestoreError(error);
        break;
      }

      result.failed += 1;
      result.failedIds.push(item.id);
    }
  }

  result.notAttempted = Math.max(
    0,
    result.planned - result.created - result.skippedExisting - result.failed,
  );

  return result;
}

function buildRelation(
  name: string,
  checked: number,
  broken: string[],
  extra: Pick<RelationCheck, 'error' | 'note'> = {},
): RelationCheck {
  return {
    name,
    checked,
    valid: Math.max(0, checked - broken.length),
    broken,
    ...(extra.error ? { error: extra.error } : {}),
    ...(extra.note ? { note: extra.note } : {}),
  };
}

export async function verifyEnrollments(
  database: Firestore,
  classDocs: ClassDoc[],
  uidByStudentCode: ReadonlyMap<string, string> = new Map(),
): Promise<EnrollmentVerification> {
  const read = await readCollectionDocuments(database, ENROLLMENTS_COLLECTION);
  if (read.error) {
    return { count: null, error: read.error, checks: [] };
  }

  const classById = new Map(classDocs.map((classDoc) => [classDoc.id, classDoc]));
  const knownUids = new Set(uidByStudentCode.values());
  const studentCodeByUid = new Map(
    [...uidByStudentCode.entries()].map(([studentCode, uid]) => [uid, studentCode]),
  );

  const brokenClasses: string[] = [];
  const brokenCourses: string[] = [];
  const brokenSemesters: string[] = [];
  const brokenPraktikans: string[] = [];
  const brokenStudentCodes: string[] = [];
  const brokenIds: string[] = [];
  const duplicateStudentCodes: string[] = [];
  const seenStudentCodes = new Map<string, string>();

  read.docs.forEach((document) => {
    const classId = stringValue(document.data.classId);
    const praktikanId = stringValue(document.data.praktikanId);
    const studentCode = stringValue(document.data.studentCode);
    const courseId = stringValue(document.data.courseId);
    const semester = document.data.semester;
    const classDoc = classById.get(classId);

    if (!classId || !classDoc) {
      brokenClasses.push(document.id);
    }
    if (!courseId || !classDoc || classDoc.courseId !== courseId) {
      brokenCourses.push(document.id);
    }
    if (
      typeof semester !== 'number' ||
      !classDoc ||
      semester !== courseSemester.get(classDoc.courseId)
    ) {
      brokenSemesters.push(document.id);
    }
    if (!praktikanId) {
      brokenPraktikans.push(document.id);
    } else if (knownUids.size > 0 && !knownUids.has(praktikanId)) {
      brokenPraktikans.push(document.id);
    }
    if (!studentCode) {
      brokenStudentCodes.push(document.id);
    } else if (
      knownUids.size > 0 &&
      studentCodeByUid.has(praktikanId) &&
      studentCodeByUid.get(praktikanId) !== studentCode
    ) {
      brokenStudentCodes.push(document.id);
    }
    if (classId && praktikanId && document.id !== buildEnrollmentId(classId, praktikanId)) {
      brokenIds.push(document.id);
    }
    if (classId && studentCode) {
      const pairKey = `${classId}\u0000${studentCode}`;
      if (seenStudentCodes.has(pairKey)) {
        duplicateStudentCodes.push(document.id);
      } else {
        seenStudentCodes.set(pairKey, document.id);
      }
    }
  });

  return {
    count: read.count,
    checks: [
      buildRelation('enrollments-class', read.docs.length, brokenClasses),
      buildRelation('enrollments-course', read.docs.length, brokenCourses),
      buildRelation('enrollments-semester', read.docs.length, brokenSemesters),
      buildRelation(
        'enrollments-praktikan',
        read.docs.length,
        brokenPraktikans,
        knownUids.size === 0
          ? { note: 'UID mapping belum tersedia; hanya keberadaan praktikanId yang diperiksa.' }
          : {},
      ),
      buildRelation(
        'enrollments-studentCode',
        read.docs.length,
        brokenStudentCodes,
        knownUids.size === 0
          ? { note: 'Konsistensi studentCode terhadap UID belum dapat diperiksa tanpa mapping.' }
          : {},
      ),
      buildRelation('enrollments-documentId', read.docs.length, brokenIds),
      buildRelation('enrollments-unique-praktikan', read.docs.length, duplicateStudentCodes),
    ],
  };
}
