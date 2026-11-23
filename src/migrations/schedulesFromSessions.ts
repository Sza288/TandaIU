import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import { firestoreDateToIso } from '../utils/firestoreDate';
import type { ClockTime, DayOfWeek } from '../types/praktikum';
import {
  describeFirestoreError,
  firestoreErrorCode,
  getDefaultDatabase,
} from './shared';
import type { MigrationStepResult } from './types';

export const SCHEDULES_COLLECTION = 'schedules';
export const SESSIONS_COLLECTION = 'sessions';

/**
 * `room` sengaja teks netral, bukan nama laboratorium: asumsi 22 pada SRS
 * menetapkan laboratorium tidak boleh dapat diturunkan dari jadwal.
 */
export const INJECTED_ROOM_LABEL = 'Ruang praktikum';

const TIME_ZONE = 'Asia/Jakarta';

export type ExistingSession = {
  id: string;
  classId: string;
  courseId: string;
  startsAt: string;
  endsAt: string;
  semesterParity: 'ganjil' | 'genap';
  assistantUid: string;
  hasScheduleId: boolean;
};

export type SchedulePlanItem = {
  groupKey: string;
  classId: string;
  courseId: string;
  dayOfWeek: DayOfWeek;
  startTime: ClockTime;
  endTime: ClockTime;
  room: string;
  semesterParity: 'ganjil' | 'genap';
  assistantUid: string;
  jumlahPertemuan: number;
  sessionIds: string[];
};

export type SchedulePlan = {
  items: SchedulePlanItem[];
  sessionsConsidered: number;
  sessionsSkippedAlreadyLinked: number;
  sessionsSkippedInvalid: string[];
  invalidSessionIds: string[];
};

export type ScheduleInjectionResult = {
  planned: number;
  created: number;
  sessionsLinked: number;
  failed: number;
  dryRun: boolean;
  createdIds: string[];
  failedGroupKeys: string[];
  blockedReason?: string;
};

function jakartaParts(iso: string): { dayOfWeek: DayOfWeek; time: ClockTime } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );

  const weekdayIndex: Record<string, DayOfWeek> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayIndex[parts.weekday ?? ''];
  if (dayOfWeek === undefined) return null;

  return {
    dayOfWeek,
    time: `${parts.hour ?? '00'}:${parts.minute ?? '00'}` as ClockTime,
  };
}

function buildGroupKey(
  classId: string,
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string,
): string {
  return `${classId}::${dayOfWeek}::${startTime}::${endTime}`;
}

/**
 * Menurunkan jadwal dari sesi yang sudah ada. Sesi dikelompokkan per kelas dan
 * per kombinasi hari/jam hasil konversi waktu WIB, sehingga satu kelas yang
 * punya dua jam berbeda menghasilkan dua jadwal. Sesi yang sudah punya
 * `scheduleId` tidak ikut dihitung ulang.
 */
export function buildSchedulePlan(sessions: readonly ExistingSession[]): SchedulePlan {
  const groups = new Map<string, SchedulePlanItem>();
  const invalidSessionIds: string[] = [];
  const sessionsSkippedInvalid: string[] = [];
  let sessionsSkippedAlreadyLinked = 0;

  for (const session of sessions) {
    if (session.hasScheduleId) {
      sessionsSkippedAlreadyLinked += 1;
      continue;
    }

    if (!session.classId || !session.courseId || !session.semesterParity || !session.assistantUid) {
      invalidSessionIds.push(session.id);
      continue;
    }

    const start = jakartaParts(session.startsAt);
    const end = jakartaParts(session.endsAt);
    if (!start || !end) {
      sessionsSkippedInvalid.push(session.id);
      continue;
    }

    const groupKey = buildGroupKey(
      session.classId,
      start.dayOfWeek,
      start.time,
      end.time,
    );
    const existing = groups.get(groupKey);
    if (existing) {
      existing.sessionIds.push(session.id);
      existing.jumlahPertemuan += 1;
      continue;
    }

    groups.set(groupKey, {
      groupKey,
      classId: session.classId,
      courseId: session.courseId,
      dayOfWeek: start.dayOfWeek,
      startTime: start.time,
      endTime: end.time,
      room: INJECTED_ROOM_LABEL,
      semesterParity: session.semesterParity,
      assistantUid: session.assistantUid,
      jumlahPertemuan: 1,
      sessionIds: [session.id],
    });
  }

  return {
    items: [...groups.values()],
    sessionsConsidered: sessions.length,
    sessionsSkippedAlreadyLinked,
    sessionsSkippedInvalid,
    invalidSessionIds,
  };
}

function readScheduleId(data: DocumentData): string {
  return typeof data.scheduleId === 'string' ? data.scheduleId.trim() : '';
}

/**
 * Membaca sesi milik satu asisten. Query wajib memakai filter karena Rules
 * menolak list tanpa batasan owner/parity.
 */
export async function readAssistantSessions(
  database: Firestore,
  assistantUid: string,
  semesterParity: 'ganjil' | 'genap',
): Promise<ExistingSession[]> {
  const snapshot = await getDocs(query(
    collection(database, SESSIONS_COLLECTION),
    where('assistantUid', '==', assistantUid),
    where('semesterParity', '==', semesterParity),
  ));

  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      classId: typeof data.classId === 'string' ? data.classId.trim() : '',
      courseId: typeof data.courseId === 'string' ? data.courseId.trim() : '',
      startsAt: firestoreDateToIso(data.startsAt),
      endsAt: firestoreDateToIso(data.endsAt),
      semesterParity: data.semesterParity === 'genap' ? 'genap' : 'ganjil',
      assistantUid: typeof data.assistantUid === 'string' ? data.assistantUid.trim() : '',
      hasScheduleId: readScheduleId(data) !== '',
    };
  });
}

/**
 * Menulis jadwal untuk setiap grup lalu menautkan `scheduleId` ke sesi
 * anggotanya. Idempotent: grup yang jadwalnya sudah ada hanya ditautkan.
 */
export async function injectSchedulesFromSessions(
  plan: SchedulePlan,
  options: { database?: Firestore; dryRun?: boolean } = {},
): Promise<ScheduleInjectionResult> {
  const database = options.database ?? getDefaultDatabase();
  const result: ScheduleInjectionResult = {
    planned: plan.items.length,
    created: 0,
    sessionsLinked: 0,
    failed: 0,
    dryRun: options.dryRun ?? false,
    createdIds: [],
    failedGroupKeys: [],
  };

  if (result.dryRun) return result;

  const existing = await getDocs(collection(database, SCHEDULES_COLLECTION));
  const scheduleIdByGroup = new Map<string, string>();
  existing.docs.forEach((document) => {
    const data = document.data();
    const classId = typeof data.classId === 'string' ? data.classId.trim() : '';
    if (!classId) return;
    const key = buildGroupKey(
      classId,
      data.dayOfWeek as DayOfWeek,
      String(data.startTime ?? ''),
      String(data.endTime ?? ''),
    );
    if (!scheduleIdByGroup.has(key)) scheduleIdByGroup.set(key, document.id);
  });

  for (const item of plan.items) {
    try {
      let scheduleId = scheduleIdByGroup.get(item.groupKey);

      if (!scheduleId) {
        const reference = doc(collection(database, SCHEDULES_COLLECTION));
        await runTransaction(database, async (transaction) => {
          transaction.set(reference, {
            classId: item.classId,
            courseId: item.courseId,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
            room: item.room,
            semesterParity: item.semesterParity,
            assistantUid: item.assistantUid,
            jumlahPertemuan: item.jumlahPertemuan,
          });
        });
        scheduleId = reference.id;
        scheduleIdByGroup.set(item.groupKey, scheduleId);
        result.created += 1;
        result.createdIds.push(scheduleId);
      }

      for (const sessionId of item.sessionIds) {
        await runTransaction(database, async (transaction) => {
          transaction.update(doc(database, SESSIONS_COLLECTION, sessionId), {
            scheduleId,
          });
        });
        result.sessionsLinked += 1;
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
      result.failedGroupKeys.push(item.groupKey);
    }
  }

  return result;
}

export function scheduleInjectionStep(
  plan: SchedulePlan,
  result: ScheduleInjectionResult | null,
): MigrationStepResult {
  const details = [
    `Sesi dibaca: ${plan.sessionsConsidered}; sudah punya scheduleId: ${plan.sessionsSkippedAlreadyLinked}.`,
    `Jadwal target: ${plan.items.length} grup (kelas + hari + jam).`,
    `Sesi tanpa classId/courseId/parity/owner: ${plan.invalidSessionIds.length}; waktu tidak valid: ${plan.sessionsSkippedInvalid.length}.`,
    `room diisi "${INJECTED_ROOM_LABEL}" agar laboratorium tidak dapat diturunkan dari jadwal (asumsi 22 SRS).`,
    'jumlahPertemuan diisi jumlah sesi nyata pada grup tersebut.',
  ];

  if (result?.blockedReason) {
    return {
      id: 'schedules-from-sessions',
      title: 'Jadwal dari sesi',
      status: 'blocked',
      summary: `Penulisan jadwal dihentikan: ${result.blockedReason}`,
      details,
    };
  }

  if (!result || result.dryRun) {
    return {
      id: 'schedules-from-sessions',
      title: 'Jadwal dari sesi',
      status: 'skipped',
      summary: `Dry-run: ${plan.items.length} jadwal siap dibuat dan ${plan.items.reduce(
        (total, item) => total + item.sessionIds.length,
        0,
      )} sesi siap ditautkan tanpa penulisan.`,
      details,
    };
  }

  if (result.failed > 0) {
    return {
      id: 'schedules-from-sessions',
      title: 'Jadwal dari sesi',
      status: 'failed',
      summary: `${result.failed} grup jadwal gagal diproses; data lama tidak diubah.`,
      details,
    };
  }

  return {
    id: 'schedules-from-sessions',
    title: 'Jadwal dari sesi',
    status: 'applied',
    summary: `Jadwal dibuat: ${result.created}; sesi ditautkan: ${result.sessionsLinked}.`,
    details,
  };
}
