import { courses } from '../data/courses';
import { initialSessions } from '../data/sessions';
import { praktikans } from '../data/praktikans';
import type { PracticumSession } from '../types';
import type { ClassDoc } from '../types/praktikum';
import type {
  AccountTemplateIssue,
  AccountTemplateReport,
} from './accounts';
import { buildClassDocumentId, buildClassKey } from './classesSessions';
import {
  buildEnrollmentAccountMap,
  buildEnrollmentPlan,
} from './enrollments';
import { stringValue } from './shared';
import type { EnrollmentPlan } from './types';

export type SeedSessionMapping = {
  sessionId: string;
  courseId: string;
  practicumName: string;
  className: string;
  semester: number | null;
  expectedClassId: string;
};

export type DuplicateClassPair = {
  key: string;
  courseId: string;
  className: string;
  sessionIds: string[];
};

export type SeedValidation = {
  sessions: SeedSessionMapping[];
  classes: ClassDoc[];
  duplicateSessionIds: string[];
  duplicateClassPairs: DuplicateClassPair[];
  invalidCourseIds: string[];
  missingClassNames: string[];
};

export type RequiredMapping = {
  praktikanId: string;
  praktikanName: string;
  studentCode: string;
  uid: string;
};

export type EnrollmentTargetGroup = {
  classId: string;
  courseId: string;
  className: string;
  semester: number | null;
  praktikanCount: number;
  studentCodes: string[];
};

export type PreflightReport = {
  seed: SeedValidation;
  targets: EnrollmentTargetGroup[];
  targetTotal: number;
  targetIssues: string[];
  accountFormat: string | null;
  accountEntries: number;
  accountInvalid: number;
  accountIssues: AccountTemplateIssue[];
  accountUnknownLocalIds: string[];
  missingLocalIds: string[];
  duplicateUids: { value: string; praktikanIds: string[] }[];
  duplicateStudentCodes: { value: string; praktikanIds: string[] }[];
  requiredMappings: RequiredMapping[];
  mappedUids: number;
  expectedEnrollments: number;
  readyEnrollments: number;
  missingUids: number;
  blockers: string[];
  notes: string[];
};

/**
 * Validasi pasangan courseId + className dari seed sessions. Tidak membaca
 * Firestore; hasil ini adalah kontrak yang nanti dicek ulang oleh dry-run.
 */
export function buildSeedValidation(
  sessions: PracticumSession[] = initialSessions,
): SeedValidation {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const seenSessionIds = new Set<string>();
  const duplicateSessionIds = new Set<string>();
  const pairSessions = new Map<string, string[]>();
  const classesByKey = new Map<string, ClassDoc>();
  const invalidCourseIds = new Set<string>();
  const missingClassNames = new Set<string>();
  const mappings: SeedSessionMapping[] = [];

  sessions.forEach((session) => {
    const courseId = stringValue(session.courseId);
    const className = stringValue(session.className);
    const course = courseById.get(courseId);

    if (seenSessionIds.has(session.id)) {
      duplicateSessionIds.add(session.id);
    } else {
      seenSessionIds.add(session.id);
    }
    if (!course) {
      invalidCourseIds.add(courseId || session.id);
    }
    if (!className) {
      missingClassNames.add(session.id);
    }

    const expectedClassId =
      courseId && className ? buildClassDocumentId(courseId, className) : '';

    mappings.push({
      sessionId: session.id,
      courseId,
      practicumName: session.practicumName,
      className,
      semester: course?.semester ?? null,
      expectedClassId,
    });

    if (!courseId || !className) return;

    const key = buildClassKey(courseId, className);
    const pair = pairSessions.get(key) ?? [];
    pair.push(session.id);
    pairSessions.set(key, pair);

    if (!classesByKey.has(key)) {
      classesByKey.set(key, {
        id: expectedClassId,
        courseId,
        className,
        createdAt: '',
      });
    }
  });

  const duplicateClassPairs = [...pairSessions.entries()]
    .filter(([, sessionIds]) => sessionIds.length > 1)
    .map(([key, sessionIds]) => {
      const classDoc = classesByKey.get(key);
      return {
        key,
        courseId: classDoc?.courseId ?? '',
        className: classDoc?.className ?? '',
        sessionIds,
      };
    });

  return {
    sessions: mappings,
    classes: [...classesByKey.values()],
    duplicateSessionIds: [...duplicateSessionIds],
    duplicateClassPairs,
    invalidCourseIds: [...invalidCourseIds],
    missingClassNames: [...missingClassNames],
  };
}

function allLocalMappings(): RequiredMapping[] {
  return praktikans.map((praktikan) => ({
    praktikanId: praktikan.id,
    praktikanName: praktikan.name,
    studentCode: stringValue(praktikan.studentCode),
    uid: '',
  }));
}

function requiredMappings(accounts: AccountTemplateReport | null): RequiredMapping[] {
  if (!accounts) return allLocalMappings();

  return accounts.entries.map((entry) => ({
    praktikanId: entry.praktikanId,
    praktikanName: entry.praktikanName,
    studentCode: entry.studentCode,
    uid: entry.uid,
  }));
}

export function buildPreflightReport(
  accounts: AccountTemplateReport | null,
  sessions: PracticumSession[] = initialSessions,
): PreflightReport {
  const seed = buildSeedValidation(sessions);
  const courseSemester = new Map(courses.map((course) => [course.id, course.semester]));
  const targets: EnrollmentTargetGroup[] = seed.classes.map((classDoc) => {
    const semester = courseSemester.get(classDoc.courseId) ?? null;
    const cohort =
      semester === null
        ? []
        : praktikans.filter((praktikan) => praktikan.semester === semester);

    return {
      classId: classDoc.id,
      courseId: classDoc.courseId,
      className: classDoc.className,
      semester,
      praktikanCount: cohort.length,
      studentCodes: cohort
        .map((praktikan) => stringValue(praktikan.studentCode))
        .sort(),
    };
  });
  const targetTotal = targets.reduce((total, target) => total + target.praktikanCount, 0);
  const targetIssues: string[] = [];

  targets.forEach((target) => {
    if (target.classId !== buildClassDocumentId(target.courseId, target.className)) {
      targetIssues.push(
        `${target.classId}: classId tidak cocok dengan courseId + className.`,
      );
    }
    if (target.semester === null) {
      targetIssues.push(`${target.classId}: semester mata kuliah tidak ditemukan.`);
    }
    if (target.praktikanCount === 0) {
      targetIssues.push(`${target.classId}: tidak ada praktikan pada semester terkait.`);
    }
  });

  const accountMap = buildEnrollmentAccountMap(accounts?.accounts ?? []);
  const plan: EnrollmentPlan = buildEnrollmentPlan(
    seed.classes,
    accountMap.uidByStudentCode,
  );

  if (targetTotal !== plan.expectedCount) {
    targetIssues.push(
      `Total target ${targetTotal} tidak sama dengan rencana enrollment ${plan.expectedCount}.`,
    );
  }

  const required = requiredMappings(accounts);
  const missingMappings = required.filter((mapping) => !mapping.uid);
  const blockers: string[] = [
    'firestore.rules belum memiliki match /enrollments/{enrollmentId}; default-deny menolak create/read.',
    'users tidak dapat di-list oleh rules, sehingga keberadaan UID harus diverifikasi manual dari Firebase Console Authentication.',
  ];

  if (!accounts) {
    blockers.push(
      'File mapping belum diberikan; 31 UID praktikan masih dibutuhkan sebelum enrollment dapat direncanakan.',
    );
  } else if (accounts.invalid.length > 0) {
    blockers.push(`${accounts.invalid.length} entri mapping tidak valid dan harus diperbaiki.`);
  }

  if (accounts && accounts.missingLocalIds.length > 0) {
    blockers.push(
      `${accounts.missingLocalIds.length} praktikan lokal belum ada di template: ${accounts.missingLocalIds.join(', ')}.`,
    );
  }

  if (accounts && accounts.duplicateUids.length > 0) {
    blockers.push(`${accounts.duplicateUids.length} UID dipakai oleh lebih dari satu praktikan.`);
  }

  if (seed.invalidCourseIds.length > 0) {
    blockers.push(
      `${seed.invalidCourseIds.length} courseId sesi tidak ada di src/data/courses.ts.`,
    );
  }

  if (seed.duplicateClassPairs.length > 0) {
    blockers.push(
      `${seed.duplicateClassPairs.length} pasangan courseId + className dipakai lebih dari satu sesi.`,
    );
  }

  if (plan.unresolvedClassIds.length > 0) {
    blockers.push(
      `${plan.unresolvedClassIds.length} kelas tidak memiliki semester lokal dan tidak dapat dihitung enrollment-nya.`,
    );
  }

  if (targetIssues.length > 0) {
    blockers.push(`${targetIssues.length} masalah ditemukan pada relasi target enrollment.`);
  }

  if (missingMappings.length > 0) {
    blockers.push(
      `${missingMappings.length} UID praktikan belum diisi; tidak ada enrollment yang boleh ditulis.`,
    );
  }

  return {
    seed,
    targets,
    targetTotal,
    targetIssues,
    accountFormat: accounts?.format ?? null,
    accountEntries: accounts?.entries.length ?? 0,
    accountInvalid: accounts?.invalid.length ?? 0,
    accountIssues: accounts?.invalid ?? [],
    accountUnknownLocalIds: accounts?.unknownLocalIds ?? [],
    missingLocalIds: accounts?.missingLocalIds ?? allLocalMappings().map((item) => item.praktikanId),
    duplicateUids: accounts?.duplicateUids ?? [],
    duplicateStudentCodes: accounts?.duplicateStudentCodes ?? [],
    requiredMappings: required,
    mappedUids: accountMap.summary.mapped,
    expectedEnrollments: plan.expectedCount,
    readyEnrollments: plan.items.length,
    missingUids: missingMappings.length,
    blockers,
    notes: [
      'Validasi ini memakai 12 seed sessions dari src/data/sessions.ts, bukan pembacaan Firestore.',
      'Pemeriksaan 12 dokumen sessions Firestore yang sebenarnya membutuhkan akun Auth; jalankan --dry-run setelah kredensial tersedia.',
      'Template hanya berisi placeholder UID kosong; tidak ada UID yang dikarang atau akun yang dibuat.',
    ],
  };
}
