import { doc, runTransaction, type Firestore } from 'firebase/firestore';

import type { LaboratoryDoc } from '../types/praktikum';
import {
  describeFirestoreError,
  firestoreErrorCode,
  getDefaultDatabase,
  readCollectionDocuments,
} from './shared';
import type { MigrationStepResult } from './types';

export const LABORATORIES_COLLECTION = 'laboratories';

export type LaboratorySeed = Omit<LaboratoryDoc, 'id'>;

export type LaboratorySeedPlanItem = LaboratorySeed & { id: string };

export type LaboratorySeedResult = {
  planned: number;
  created: number;
  skippedExisting: number;
  failed: number;
  dryRun: boolean;
  createdIds: string[];
  skippedIds: string[];
  failedIds: string[];
  blockedReason?: string;
};

// Titik tengah gedung, Plus Code XC2R+P8 / XC2R+P82, Tembalang, Semarang.
// Ketiga laboratorium berbagi koordinat karena berada di gedung yang sama.
const BUILDING_LATITUDE = -7.0482469;
const BUILDING_LONGITUDE = 110.4407531;
const BUILDING_FLOOR = 2;
const PRESENCE_RADIUS_METERS = 500;

export function buildLaboratorySeeds(createdAt: string): LaboratorySeedPlanItem[] {
  return [
    {
      id: 'lab-b',
      name: 'Laboratorium B',
      latitude: BUILDING_LATITUDE,
      longitude: BUILDING_LONGITUDE,
      radius: PRESENCE_RADIUS_METERS,
      lantai: BUILDING_FLOOR,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'lab-c',
      name: 'Laboratorium C',
      latitude: BUILDING_LATITUDE,
      longitude: BUILDING_LONGITUDE,
      radius: PRESENCE_RADIUS_METERS,
      lantai: BUILDING_FLOOR,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'lab-d',
      name: 'Laboratorium D',
      latitude: BUILDING_LATITUDE,
      longitude: BUILDING_LONGITUDE,
      radius: PRESENCE_RADIUS_METERS,
      lantai: BUILDING_FLOOR,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

export async function seedLaboratories(
  options: { database?: Firestore; createdAt?: string; dryRun?: boolean } = {},
): Promise<LaboratorySeedResult> {
  const database = options.database ?? getDefaultDatabase();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const plan = buildLaboratorySeeds(createdAt);
  const result: LaboratorySeedResult = {
    planned: plan.length,
    created: 0,
    skippedExisting: 0,
    failed: 0,
    dryRun: options.dryRun ?? false,
    createdIds: [],
    skippedIds: [],
    failedIds: [],
  };

  if (result.dryRun) return result;

  for (const item of plan) {
    const { id, ...payload } = item;
    const reference = doc(database, LABORATORIES_COLLECTION, id);

    try {
      const outcome = await runTransaction(database, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists()) return 'skipped' as const;
        transaction.set(reference, payload);
        return 'created' as const;
      });

      if (outcome === 'created') {
        result.created += 1;
        result.createdIds.push(id);
      } else {
        result.skippedExisting += 1;
        result.skippedIds.push(id);
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
      result.failedIds.push(id);
    }
  }

  return result;
}

export async function verifyLaboratories(database: Firestore): Promise<{
  count: number | null;
  missing: string[];
  error?: string;
}> {
  const read = await readCollectionDocuments(database, LABORATORIES_COLLECTION);
  if (read.error) {
    return { count: null, missing: [], error: read.error };
  }

  const existing = new Set(read.docs.map((document) => document.id));
  const missing = buildLaboratorySeeds('').map((seed) => seed.id).filter((id) => !existing.has(id));
  return { count: read.count, missing };
}

export function laboratorySeedStep(result: LaboratorySeedResult): MigrationStepResult {
  const details = [
    `Laboratorium target: ${result.planned} (lab-b, lab-c, lab-d).`,
    `Dibuat: ${result.created}; sudah ada: ${result.skippedExisting}; gagal: ${result.failed}.`,
    'ID dokumen tetap agar modul presensi dan Maps memakai referensi laboratorium yang sama.',
    'Seed tidak menimpa laboratorium yang sudah ada, sehingga perubahan radius oleh asisten tetap dipertahankan.',
  ];

  if (result.dryRun) {
    return {
      id: 'laboratories',
      title: 'Laboratories',
      status: 'skipped',
      summary: `Dry-run: ${result.planned} laboratorium siap dibuat tanpa penulisan.`,
      details,
    };
  }

  if (result.blockedReason) {
    return {
      id: 'laboratories',
      title: 'Laboratories',
      status: 'blocked',
      summary: `Penulisan laboratorium dihentikan: ${result.blockedReason}`,
      details,
    };
  }

  if (result.failed > 0) {
    return {
      id: 'laboratories',
      title: 'Laboratories',
      status: 'failed',
      summary: `${result.failed} laboratorium gagal ditulis.`,
      details,
    };
  }

  return {
    id: 'laboratories',
    title: 'Laboratories',
    status: 'applied',
    summary: `Laboratorium idempotent: ${result.created} dibuat, ${result.skippedExisting} sudah ada.`,
    details,
  };
}
