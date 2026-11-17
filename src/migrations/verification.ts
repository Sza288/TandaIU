import type { Firestore } from 'firebase/firestore';

import { courses } from '../data/courses';
import { dosen } from '../data/dosen';
import { type ClassDoc } from '../types/praktikum';
import { verifyEnrollments } from './enrollments';
import {
  MIGRATION_COLLECTIONS,
  readCollectionDocuments,
  stringValue,
  type CollectionRead,
  type RawDocument,
} from './shared';
import type {
  CollectionVerification,
  MigrationVerification,
  RelationCheck,
} from './types';

export type VerifyMigrationOptions = {
  uidByStudentCode?: ReadonlyMap<string, string>;
  classDocs?: ClassDoc[];
};

const courseIds = new Set(courses.map((course) => course.id));
const dosenById: ReadonlyMap<string, (typeof dosen)[number]> = new Map(
  dosen.map((lecturer) => [lecturer.id, lecturer]),
);

const SESSION_STATUSES = new Set(['terjadwal', 'dibuka', 'ditutup']);
const PERMIT_STATUSES = new Set(['pending', 'approved', 'rejected']);
const SENTIMENTS = new Set(['positif', 'netral', 'negatif']);
const SENTIMENT_SOURCES = new Set(['model', 'fallback']);

function relation(
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

function readOrEmpty(
  reads: Map<string, CollectionRead>,
  name: string,
): CollectionRead {
  return reads.get(name) ?? { name, docs: [], count: null };
}

function toClassDoc(document: RawDocument): ClassDoc | null {
  const courseId = stringValue(document.data.courseId);
  const className = stringValue(document.data.className);
  if (!courseId || !className) return null;

  return {
    id: document.id,
    courseId,
    className,
    createdAt: typeof document.data.createdAt === 'string' ? document.data.createdAt : '',
  };
}

function classRelations(classRead: CollectionRead): RelationCheck[] {
  const brokenCourses: string[] = [];
  const duplicates: string[] = [];
  const seen = new Map<string, string>();

  classRead.docs.forEach((document) => {
    const courseId = stringValue(document.data.courseId);
    const className = stringValue(document.data.className);
    if (!courseId || !courseIds.has(courseId)) {
      brokenCourses.push(document.id);
    }

    const key = `${courseId}\u0000${className}`;
    if (seen.has(key)) {
      duplicates.push(document.id);
    } else {
      seen.set(key, document.id);
    }
  });

  return [
    relation('classes-course', classRead.docs.length, brokenCourses),
    relation(
      'classes-unique',
      classRead.docs.length,
      duplicates,
      duplicates.length > 0
        ? { note: 'Dokumen duplikat tidak dipakai sebagai kelas kanonik oleh migrasi.' }
        : {},
    ),
  ];
}

function sessionRelations(
  sessionRead: CollectionRead,
  classById: ReadonlyMap<string, ClassDoc>,
): RelationCheck[] {
  const brokenClasses: string[] = [];
  const brokenCourses: string[] = [];
  const brokenLecturers: string[] = [];
  const brokenStatuses: string[] = [];
  let lecturerChecked = 0;

  sessionRead.docs.forEach((document) => {
    const classId = stringValue(document.data.classId);
    const courseId = stringValue(document.data.courseId);
    const className = stringValue(document.data.className);
    const classDoc = classById.get(classId);

    if (
      !classId ||
      !classDoc ||
      classDoc.courseId !== courseId ||
      classDoc.className !== className
    ) {
      brokenClasses.push(document.id);
    }

    if (!courseId || !courseIds.has(courseId)) {
      brokenCourses.push(document.id);
    }

    if (!SESSION_STATUSES.has(stringValue(document.data.status))) {
      brokenStatuses.push(document.id);
    }

    const lecturerId = stringValue(document.data.lecturerId);
    if (lecturerId) {
      lecturerChecked += 1;
      const lecturer = dosenById.get(lecturerId);
      const lecturerName = stringValue(document.data.lecturer);
      if (!lecturer || (lecturerName && lecturer.name !== lecturerName)) {
        brokenLecturers.push(document.id);
      }
    }
  });

  return [
    relation('sessions-class', sessionRead.docs.length, brokenClasses),
    relation('sessions-course', sessionRead.docs.length, brokenCourses),
    relation('sessions-status', sessionRead.docs.length, brokenStatuses),
    relation(
      'sessions-lecturer',
      lecturerChecked,
      brokenLecturers,
      lecturerChecked === 0 ? { note: 'Belum ada sesi dengan lecturerId; dosen tetap master data lokal.' } : {},
    ),
  ];
}

function scheduleRelations(
  scheduleRead: CollectionRead,
  classById: ReadonlyMap<string, ClassDoc>,
): RelationCheck[] {
  const brokenClasses: string[] = [];
  const brokenCourses: string[] = [];

  scheduleRead.docs.forEach((document) => {
    const classId = stringValue(document.data.classId);
    const courseId = stringValue(document.data.courseId);
    const classDoc = classById.get(classId);

    if (!classId || !classDoc) {
      brokenClasses.push(document.id);
    }
    if (!courseId || !classDoc || classDoc.courseId !== courseId) {
      brokenCourses.push(document.id);
    }
  });

  return [
    relation('schedules-class', scheduleRead.docs.length, brokenClasses),
    relation('schedules-course', scheduleRead.docs.length, brokenCourses),
  ];
}

function attendanceRelations(
  attendanceRead: CollectionRead,
  sessionIds: ReadonlySet<string>,
  knownUids: ReadonlySet<string>,
): RelationCheck[] {
  const brokenSessions: string[] = [];
  const brokenPraktikans: string[] = [];
  const brokenIds: string[] = [];

  attendanceRead.docs.forEach((document) => {
    const sessionId = stringValue(document.data.sessionId);
    const praktikanId = stringValue(document.data.praktikanId);

    if (!sessionId || !sessionIds.has(sessionId)) {
      brokenSessions.push(document.id);
    }
    if (!praktikanId || (knownUids.size > 0 && !knownUids.has(praktikanId))) {
      brokenPraktikans.push(document.id);
    }
    if (sessionId && praktikanId && document.id !== `${sessionId}_${praktikanId}`) {
      brokenIds.push(document.id);
    }
  });

  return [
    relation('attendances-session', attendanceRead.docs.length, brokenSessions),
    relation(
      'attendances-praktikan',
      attendanceRead.docs.length,
      brokenPraktikans,
      knownUids.size === 0
        ? { note: 'UID mapping belum tersedia; hanya keberadaan praktikanId yang diperiksa.' }
        : {},
    ),
    relation('attendances-documentId', attendanceRead.docs.length, brokenIds),
  ];
}

function permitRelations(
  permitRead: CollectionRead,
  sessionIds: ReadonlySet<string>,
  knownUids: ReadonlySet<string>,
): RelationCheck[] {
  const brokenSessions: string[] = [];
  const brokenStudents: string[] = [];
  const brokenIds: string[] = [];
  const brokenStatuses: string[] = [];

  permitRead.docs.forEach((document) => {
    const sessionId = stringValue(document.data.sessionId);
    const studentId = stringValue(document.data.studentId);
    const status = stringValue(document.data.status);

    if (!sessionId || !sessionIds.has(sessionId)) {
      brokenSessions.push(document.id);
    }
    if (!studentId || (knownUids.size > 0 && !knownUids.has(studentId))) {
      brokenStudents.push(document.id);
    }
    if (sessionId && studentId && document.id !== `${sessionId}_${studentId}`) {
      brokenIds.push(document.id);
    }
    if (!PERMIT_STATUSES.has(status)) {
      brokenStatuses.push(document.id);
    }
  });

  return [
    relation('permits-session', permitRead.docs.length, brokenSessions),
    relation(
      'permits-praktikan',
      permitRead.docs.length,
      brokenStudents,
      knownUids.size === 0
        ? { note: 'UID mapping belum tersedia; hanya keberadaan studentId yang diperiksa.' }
        : {},
    ),
    relation('permits-documentId', permitRead.docs.length, brokenIds),
    relation('permits-status', permitRead.docs.length, brokenStatuses),
  ];
}

function reviewRelations(
  reviewRead: CollectionRead,
  sessionById: ReadonlyMap<string, RawDocument>,
  knownUids: ReadonlySet<string>,
): RelationCheck[] {
  const brokenSessions: string[] = [];
  const brokenStudents: string[] = [];
  const brokenIds: string[] = [];
  const brokenSentiments: string[] = [];
  const openSessions: string[] = [];

  reviewRead.docs.forEach((document) => {
    const sessionId = stringValue(document.data.sessionId);
    const studentId = stringValue(document.data.studentId);
    const sentiment = stringValue(document.data.sentiment);
    const source = stringValue(document.data.sentimentSource);
    const session = sessionById.get(sessionId);

    if (!sessionId || !session) {
      brokenSessions.push(document.id);
    } else if (stringValue(session.data.status) !== 'ditutup') {
      openSessions.push(document.id);
    }
    if (!studentId || (knownUids.size > 0 && !knownUids.has(studentId))) {
      brokenStudents.push(document.id);
    }
    if (sessionId && studentId && document.id !== `${sessionId}_${studentId}`) {
      brokenIds.push(document.id);
    }
    if (!SENTIMENTS.has(sentiment) || !SENTIMENT_SOURCES.has(source)) {
      brokenSentiments.push(document.id);
    }
  });

  return [
    relation('reviews-session', reviewRead.docs.length, brokenSessions),
    relation(
      'reviews-session-ditutup',
      reviewRead.docs.length - brokenSessions.length,
      openSessions,
    ),
    relation(
      'reviews-praktikan',
      reviewRead.docs.length,
      brokenStudents,
      knownUids.size === 0
        ? { note: 'UID mapping belum tersedia; hanya keberadaan studentId yang diperiksa.' }
        : {},
    ),
    relation('reviews-documentId', reviewRead.docs.length, brokenIds),
    relation('reviews-sentiment', reviewRead.docs.length, brokenSentiments),
  ];
}

export async function verifyMigration(
  database: Firestore,
  options: VerifyMigrationOptions = {},
): Promise<MigrationVerification> {
  const uidByStudentCode = options.uidByStudentCode ?? new Map<string, string>();
  const knownUids = new Set(uidByStudentCode.values());

  const reads = await Promise.all(
    MIGRATION_COLLECTIONS.map((name) => readCollectionDocuments(database, name)),
  );
  const readByName = new Map(reads.map((read) => [read.name, read]));

  const classRead = readOrEmpty(readByName, 'classes');
  const sessionRead = readOrEmpty(readByName, 'sessions');
  const scheduleRead = readOrEmpty(readByName, 'schedules');
  const attendanceRead = readOrEmpty(readByName, 'attendances');
  const permitRead = readOrEmpty(readByName, 'permits');
  const reviewRead = readOrEmpty(readByName, 'reviews');
  const userRead = readOrEmpty(readByName, 'users');

  const classDocs =
    options.classDocs ??
    classRead.docs
      .map((document) => toClassDoc(document))
      .filter((item): item is ClassDoc => item !== null);
  const classById = new Map(classDocs.map((classDoc) => [classDoc.id, classDoc]));
  const sessionIds = new Set(sessionRead.docs.map((document) => document.id));
  const sessionById = new Map(
    sessionRead.docs.map((document) => [document.id, document] as const),
  );

  const enrollmentVerification = await verifyEnrollments(
    database,
    [...classById.values()],
    uidByStudentCode,
  );

  const collections: CollectionVerification[] = [
    {
      name: 'users',
      count: userRead.count,
      ...(userRead.error ? { error: userRead.error } : {}),
      note:
        'Rules users melarang list; jumlah dokumen hanya dapat dilihat dari Firebase Console. Migrasi tidak membuat atau mengubah profil.',
      relations: [],
    },
    {
      name: 'classes',
      count: classRead.count,
      ...(classRead.error ? { error: classRead.error } : {}),
      relations: classRead.error ? [] : classRelations(classRead),
    },
    {
      name: 'schedules',
      count: scheduleRead.count,
      ...(scheduleRead.error ? { error: scheduleRead.error } : {}),
      relations: scheduleRead.error ? [] : scheduleRelations(scheduleRead, classById),
    },
    {
      name: 'sessions',
      count: sessionRead.count,
      ...(sessionRead.error ? { error: sessionRead.error } : {}),
      relations: sessionRead.error ? [] : sessionRelations(sessionRead, classById),
    },
    {
      name: 'enrollments',
      count: enrollmentVerification.count,
      ...(enrollmentVerification.error ? { error: enrollmentVerification.error } : {}),
      note:
        'ID deterministik {classId}_{praktikanId}; penulisan membutuhkan match enrollments pada Security Rules.',
      relations: enrollmentVerification.checks,
    },
    {
      name: 'attendances',
      count: attendanceRead.count,
      ...(attendanceRead.error ? { error: attendanceRead.error } : {}),
      relations: attendanceRead.error
        ? []
        : attendanceRelations(attendanceRead, sessionIds, knownUids),
    },
    {
      name: 'permits',
      count: permitRead.count,
      ...(permitRead.error ? { error: permitRead.error } : {}),
      relations: permitRead.error
        ? []
        : permitRelations(permitRead, sessionIds, knownUids),
    },
    {
      name: 'reviews',
      count: reviewRead.count,
      ...(reviewRead.error ? { error: reviewRead.error } : {}),
      relations: reviewRead.error
        ? []
        : reviewRelations(reviewRead, sessionById, knownUids),
    },
  ];

  return { collections };
}
