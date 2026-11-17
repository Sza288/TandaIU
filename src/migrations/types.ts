import type { Semester } from '../types';

export type MigrationStepStatus = 'applied' | 'skipped' | 'blocked' | 'failed';

export type MigrationStepResult = {
  id: string;
  title: string;
  status: MigrationStepStatus;
  summary: string;
  details: string[];
};

export type CollectionCount = {
  name: string;
  count: number | null;
  error?: string;
};

export type ClassSessionMigrationResult = {
  dryRun: boolean;
  classesCreated: number;
  classesReused: number;
  duplicateClasses: string[];
  sessionsUpdated: number;
  sessionsAlreadyMigrated: number;
  sessionsMissing: string[];
  sessionsWithoutMatchingClass: string[];
  sessionsInvalid: string[];
  invalidExistingClassIds: string[];
  verification: {
    sessionsWithClassId: number;
    validClassReferences: number;
    invalidClassReferences: string[];
    sessionsWithoutClassId: string[];
  };
};

export type EnrollmentAccount = {
  uid: string;
  studentCode: string;
  name?: string;
};

export type EnrollmentAccountIssue = {
  value: string;
  reason: string;
};

export type EnrollmentAccountSummary = {
  accounts: number;
  mapped: number;
  duplicateStudentCodes: { studentCode: string; uids: string[] }[];
  duplicateUids: { uid: string; studentCodes: string[] }[];
  ignored: EnrollmentAccountIssue[];
};

export type EnrollmentAccountMap = {
  uidByStudentCode: Map<string, string>;
  summary: EnrollmentAccountSummary;
};

export type EnrollmentPlanItem = {
  id: string;
  praktikanId: string;
  praktikanName: string;
  studentCode: string;
  classId: string;
  courseId: string;
  semester: Semester;
};

export type EnrollmentPlan = {
  expectedCount: number;
  items: EnrollmentPlanItem[];
  missingStudentCodes: string[];
  unresolvedClassIds: string[];
  duplicateClassIds: string[];
};

export type EnrollmentWriteResult = {
  planned: number;
  created: number;
  skippedExisting: number;
  failed: number;
  notAttempted: number;
  dryRun: boolean;
  blockedReason?: string;
  createdIds: string[];
  skippedIds: string[];
  failedIds: string[];
};

export type RelationCheck = {
  name: string;
  checked: number;
  valid: number;
  broken: string[];
  error?: string;
  note?: string;
};

export type CollectionVerification = {
  name: string;
  count: number | null;
  error?: string;
  note?: string;
  relations: RelationCheck[];
};

export type MigrationVerification = {
  collections: CollectionVerification[];
};

export type MigrationRunResult = {
  dryRun: boolean;
  countsBefore: CollectionCount[];
  countsAfter: CollectionCount[];
  steps: MigrationStepResult[];
  classSessions: ClassSessionMigrationResult | null;
  enrollmentAccounts: EnrollmentAccountSummary;
  enrollmentPlan: EnrollmentPlan;
  enrollmentWrite: EnrollmentWriteResult | null;
  verification: MigrationVerification;
};
