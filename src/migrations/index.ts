import type { Firestore } from 'firebase/firestore';

import type { ClassDoc } from '../types/praktikum';
import {
  migrateClassesAndSessions,
  readClassDocs,
} from './classesSessions';
import { getCoursesDosenStep } from './coursesDosen';
import {
  buildEnrollmentAccountMap,
  buildEnrollmentPlan,
  createMissingEnrollments,
} from './enrollments';
import { getOtherDummyDataSteps } from './otherDummyData';
import {
  describeFirestoreError,
  firestoreErrorCode,
  getDefaultDatabase,
  readCollectionCounts,
} from './shared';
import { verifyMigration } from './verification';
import type {
  ClassSessionMigrationResult,
  EnrollmentAccount,
  EnrollmentAccountSummary,
  EnrollmentPlan,
  EnrollmentWriteResult,
  MigrationRunResult,
  MigrationStepResult,
  MigrationVerification,
} from './types';

export type RunMigrationOptions = {
  database?: Firestore;
  enrollmentAccounts?: EnrollmentAccount[];
  now?: () => Date;
  dryRun?: boolean;
};

function failedClassStep(error: unknown): MigrationStepResult {
  const blocked = firestoreErrorCode(error) === 'permission-denied';

  return {
    id: 'classes-sessions',
    title: 'Classes dan sessions.classId',
    status: blocked ? 'blocked' : 'failed',
    summary: blocked
      ? 'Migrasi classes/sessions ditolak Security Rules atau akun operator bukan asisten.'
      : `Migrasi classes/sessions gagal: ${describeFirestoreError(error)}`,
    details: [
      describeFirestoreError(error),
      'Tidak ada data yang ditimpa atau dihapus.',
      'Jalankan migrasi dengan akun asisten yang terautentikasi agar classes/sessions dapat ditulis.',
    ],
  };
}

function classStep(result: ClassSessionMigrationResult): MigrationStepResult {
  const { verification } = result;
  const details = [
    `Kelas dibuat: ${result.classesCreated}; dipakai ulang: ${result.classesReused}; duplikat: ${result.duplicateClasses.length}.`,
    `Sesi diperbarui: ${result.sessionsUpdated}; sudah termigrasi: ${result.sessionsAlreadyMigrated}; classId lama tidak valid: ${result.invalidExistingClassIds.length}.`,
    `Referensi classId valid: ${verification.validClassReferences}/${verification.sessionsWithClassId}; sesi tanpa classId: ${verification.sessionsWithoutClassId.length}.`,
    `Sesi invalid (courseId/className kosong): ${result.sessionsInvalid.length}; sesi seed tidak ditemukan: ${result.sessionsMissing.length}.`,
    `Sesi tanpa kelas yang cocok: ${result.sessionsWithoutMatchingClass.length}.`,
  ];

  if (result.dryRun) {
    return {
      id: 'classes-sessions',
      title: 'Classes dan sessions.classId',
      status: 'skipped',
      summary: `Dry-run: ${result.classesCreated} kelas akan dibuat dan ${result.sessionsUpdated} sesi akan diberi classId; tidak ada penulisan.`,
      details: [
        ...details,
        'Angka verifikasi di bawah menunjukkan kondisi Firestore saat ini, bukan hasil rencana dry-run.',
      ],
    };
  }

  return {
    id: 'classes-sessions',
    title: 'Classes dan sessions.classId',
    status: 'applied',
    summary:
      'Relasi classes dan sessions.classId dimigrasikan secara idempotent tanpa menimpa field lain.',
    details,
  };
}

function enrollmentStep(
  plan: EnrollmentPlan,
  accounts: EnrollmentAccountSummary,
  write: EnrollmentWriteResult | null,
  dryRun: boolean,
): MigrationStepResult {
  const details = [
    `Target relasi: ${plan.expectedCount} enrollment dari ${plan.items.length} pasangan UID/kelas.`,
    `Akun mapping: ${accounts.mapped}/${accounts.accounts}; kode mahasiswa tanpa UID: ${plan.missingStudentCodes.length}.`,
    `Kelas duplikat diabaikan: ${plan.duplicateClassIds.length}; kelas tanpa mata kuliah lokal: ${plan.unresolvedClassIds.length}.`,
    'ID dokumen deterministik {classId}_{praktikanId}.',
    'firestore.rules tidak memiliki match enrollments; sampai pemilik rules menambahkannya, penulisan akan ditolak. Migrasi tidak mengubah rules.',
  ];

  if (accounts.accounts === 0) {
    return {
      id: 'enrollments',
      title: 'Enrollments',
      status: 'blocked',
      summary:
        'UID praktikan Firebase Auth belum tersedia; tidak ada enrollment yang ditulis.',
      details: [
        ...details,
        'Sediakan mapping studentCode -> UID dari Firebase Console Authentication.',
        'UID demo lokal p1..p31 ditolak dan tidak pernah dipakai sebagai praktikanId.',
      ],
    };
  }

  if (plan.items.length === 0) {
    return {
      id: 'enrollments',
      title: 'Enrollments',
      status: 'blocked',
      summary:
        'Tidak ada pasangan kelas/praktikan yang dapat dipetakan ke UID Firebase Auth.',
      details,
    };
  }

  if (dryRun || !write) {
    return {
      id: 'enrollments',
      title: 'Enrollments',
      status: 'skipped',
      summary: `Dry-run: ${plan.items.length} enrollment siap dibuat tanpa penulisan.`,
      details,
    };
  }

  const writeDetails = [
    `Ditulis: ${write.created}; sudah ada: ${write.skippedExisting}; gagal: ${write.failed}; tidak dicoba: ${write.notAttempted}.`,
    ...details,
  ];

  if (write.blockedReason) {
    return {
      id: 'enrollments',
      title: 'Enrollments',
      status: 'blocked',
      summary: `Penulisan enrollments dihentikan: ${write.blockedReason}`,
      details: writeDetails,
    };
  }

  if (write.failed > 0) {
    return {
      id: 'enrollments',
      title: 'Enrollments',
      status: 'failed',
      summary: `${write.failed} enrollment gagal ditulis; data yang sudah ada tidak ditimpa.`,
      details: writeDetails,
    };
  }

  return {
    id: 'enrollments',
    title: 'Enrollments',
    status: 'applied',
    summary: `Enrollment idempotent: ${write.created} dibuat, ${write.skippedExisting} sudah ada.`,
    details: writeDetails,
  };
}

/**
 * Menjalankan seluruh tahap migrasi dan verifikasi. Tidak ada delete, tidak ada
 * overwrite, dan kegagalan Security Rules dilaporkan sebagai blocked.
 */
export async function runMigrations(
  options: RunMigrationOptions = {},
): Promise<MigrationRunResult> {
  const database = options.database ?? getDefaultDatabase();
  const now = options.now ?? (() => new Date());
  const createdAt = now().toISOString();
  const dryRun = options.dryRun ?? false;
  const countsBefore = await readCollectionCounts(database);

  let classSessions: ClassSessionMigrationResult | null = null;
  let classDocs: ClassDoc[] = [];
  let classDocsResolved = false;
  let classesStep: MigrationStepResult;

  try {
    classSessions = await migrateClassesAndSessions(database, { dryRun });
    classDocs = await readClassDocs(database);
    classDocsResolved = true;
    classesStep = classStep(classSessions);
  } catch (error) {
    classesStep = failedClassStep(error);
  }

  const accountMap = buildEnrollmentAccountMap(options.enrollmentAccounts ?? []);
  const enrollmentPlan = buildEnrollmentPlan(
    classDocs,
    accountMap.uidByStudentCode,
  );

  let enrollmentWrite: EnrollmentWriteResult | null = null;
  if (
    accountMap.summary.accounts > 0 &&
    enrollmentPlan.items.length > 0 &&
    !dryRun
  ) {
    enrollmentWrite = await createMissingEnrollments(enrollmentPlan, {
      database,
      createdAt,
      dryRun: false,
    });
  }

  const enrollmentsStep = enrollmentStep(
    enrollmentPlan,
    accountMap.summary,
    enrollmentWrite,
    dryRun,
  );

  const verification: MigrationVerification = await verifyMigration(database, {
    uidByStudentCode: accountMap.uidByStudentCode,
    ...(classDocsResolved ? { classDocs } : {}),
  });

  const countsAfter = await readCollectionCounts(database);

  return {
    dryRun,
    countsBefore,
    countsAfter,
    steps: [
      classesStep,
      enrollmentsStep,
      getCoursesDosenStep(),
      ...getOtherDummyDataSteps(),
    ],
    classSessions,
    enrollmentAccounts: accountMap.summary,
    enrollmentPlan,
    enrollmentWrite,
    verification,
  };
}

export {
  buildClassKey,
  buildClassDocumentId,
  ensureClassesForInitialSessions,
  ensureClassesForSessions,
  migrateClassesAndSessions,
  readClassDocs,
} from './classesSessions';
export {
  buildEnrollmentAccountMap,
  buildEnrollmentDocument,
  buildEnrollmentId,
  buildEnrollmentPlan,
  createMissingEnrollments,
  ENROLLMENTS_COLLECTION,
  isLocalDemoId,
  verifyEnrollments,
} from './enrollments';
export { parseAccountTemplate } from './accounts';
export {
  buildPreflightReport,
  buildSeedValidation,
} from './preflight';
export { getCoursesDosenInventory, getCoursesDosenStep } from './coursesDosen';
export { getLocalDummyInventory, getOtherDummyDataSteps } from './otherDummyData';
export {
  describeFirestoreError,
  MIGRATION_COLLECTIONS,
  readCollectionCount,
  readCollectionCounts,
} from './shared';
export { verifyMigration } from './verification';
export type {
  AccountTemplateEntry,
  AccountTemplateIssue,
  AccountTemplateReport,
} from './accounts';
export type {
  DuplicateClassPair,
  PreflightReport,
  RequiredMapping,
  SeedSessionMapping,
  SeedValidation,
} from './preflight';
export type {
  ClassSessionMigrationResult,
  CollectionCount,
  CollectionVerification,
  EnrollmentAccount,
  EnrollmentAccountMap,
  EnrollmentAccountSummary,
  EnrollmentPlan,
  EnrollmentPlanItem,
  EnrollmentWriteResult,
  MigrationRunResult,
  MigrationStepResult,
  MigrationStepStatus,
  MigrationVerification,
  RelationCheck,
} from './types';
