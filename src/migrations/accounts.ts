import { praktikans } from '../data/praktikans';
import { isLocalDemoId } from './enrollments';
import { stringValue } from './shared';
import type { EnrollmentAccount } from './types';

export type AccountTemplateEntry = {
  praktikanId: string;
  praktikanName: string;
  studentCode: string;
  uid: string;
};

export type AccountTemplateIssue = {
  praktikanId?: string;
  studentCode?: string;
  uid?: string;
  reason: string;
};

export type DuplicateAccountValue = {
  value: string;
  praktikanIds: string[];
};

export type AccountTemplateReport = {
  format: 'array' | 'accounts-array' | 'keyed';
  totalLocalPraktikans: number;
  entries: AccountTemplateEntry[];
  accounts: EnrollmentAccount[];
  missingUids: AccountTemplateEntry[];
  missingLocalIds: string[];
  unknownLocalIds: string[];
  invalid: AccountTemplateIssue[];
  duplicateStudentCodes: DuplicateAccountValue[];
  duplicateUids: DuplicateAccountValue[];
};

type RawEntry = {
  praktikanId?: string;
  record: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readArrayEntries(value: unknown[], format: AccountTemplateReport['format']): {
  format: AccountTemplateReport['format'];
  entries: RawEntry[];
} {
  return {
    format,
    entries: value.map((item, index) => {
      const record = asRecord(item);
      if (!record) {
        throw new Error(`Entri akun ke-${index + 1} harus berupa object.`);
      }
      const praktikanId = stringValue(record.praktikanId);
      return { ...(praktikanId ? { praktikanId } : {}), record };
    }),
  };
}

function extractRawEntries(parsed: unknown): {
  format: AccountTemplateReport['format'];
  entries: RawEntry[];
} {
  if (Array.isArray(parsed)) {
    return readArrayEntries(parsed, 'array');
  }

  const object = asRecord(parsed);
  if (!object) {
    throw new Error(
      'File mapping harus berupa array, object { "accounts": [...] }, atau object dengan key p1..p31.',
    );
  }

  if (Array.isArray(object.accounts)) {
    return readArrayEntries(object.accounts, 'accounts-array');
  }

  const entries: RawEntry[] = [];
  Object.entries(object).forEach(([key, value]) => {
    if (key.startsWith('_') || key.startsWith('$')) return;
    const record = asRecord(value);
    if (!record) {
      throw new Error(
        `Entri "${key}" harus berupa object { "studentCode": "...", "uid": "..." }.`,
      );
    }
    entries.push({ praktikanId: key, record });
  });

  if (entries.length === 0) {
    throw new Error('File mapping tidak memiliki entri akun.');
  }

  return { format: 'keyed', entries };
}

function isPlaceholderUid(uid: string): boolean {
  return /^<.*>$/.test(uid) || /^(uid|placeholder|changeme|todo)$/i.test(uid);
}

function numericLocalIdCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * Membaca tiga bentuk mapping yang didukung runner:
 * 1. array [{ studentCode, uid, praktikanId? }]
 * 2. { accounts: [...] }
 * 3. { p1: { studentCode, uid }, ... }  <- format template
 *
 * UID kosong tetap dipertahankan sebagai placeholder. UID palsu/ID demo dan
 * studentCode yang tidak cocok dengan src/data/praktikans.ts ditolak.
 */
export function parseAccountTemplate(parsed: unknown): AccountTemplateReport {
  const { format, entries: rawEntries } = extractRawEntries(parsed);
  const localById = new Map(praktikans.map((praktikan) => [praktikan.id, praktikan]));
  const localByStudentCode = new Map(
    praktikans
      .filter((praktikan) => Boolean(praktikan.studentCode))
      .map((praktikan) => [stringValue(praktikan.studentCode), praktikan]),
  );

  const entries: AccountTemplateEntry[] = [];
  const invalid: AccountTemplateIssue[] = [];
  const unknownLocalIds = new Set<string>();
  const seenLocalIds = new Set<string>();

  rawEntries.forEach(({ praktikanId, record }) => {
    const providedId =
      stringValue(praktikanId) || stringValue(record.praktikanId);
    const studentCode = stringValue(record.studentCode);
    const uid = stringValue(record.uid);

    let local = providedId ? localById.get(providedId) : undefined;

    if (providedId && !local) {
      unknownLocalIds.add(providedId);
      invalid.push({
        praktikanId: providedId,
        studentCode,
        uid,
        reason: 'ID praktikan lokal tidak ditemukan di src/data/praktikans.ts.',
      });
      return;
    }

    if (!local) {
      local = localByStudentCode.get(studentCode);
      if (!local) {
        invalid.push({
          studentCode,
          uid,
          reason: 'studentCode tidak cocok dengan praktikan lokal mana pun.',
        });
        return;
      }
    }

    const expectedStudentCode = stringValue(local.studentCode);
    if (!expectedStudentCode) {
      invalid.push({
        praktikanId: local.id,
        studentCode,
        uid,
        reason: 'Praktikan lokal tidak memiliki studentCode.',
      });
      return;
    }

    if (seenLocalIds.has(local.id)) {
      invalid.push({
        praktikanId: local.id,
        studentCode,
        uid,
        reason: 'ID praktikan duplikat di dalam template.',
      });
      return;
    }
    seenLocalIds.add(local.id);

    if (studentCode && studentCode !== expectedStudentCode) {
      invalid.push({
        praktikanId: local.id,
        studentCode,
        uid,
        reason: `studentCode tidak cocok dengan ${local.id} (${expectedStudentCode}).`,
      });
      return;
    }

    if (uid && isLocalDemoId(uid)) {
      invalid.push({
        praktikanId: local.id,
        studentCode: expectedStudentCode,
        uid,
        reason: 'uid berisi ID demo lokal (p1..p31), bukan Firebase Auth UID.',
      });
      return;
    }

    if (uid && isPlaceholderUid(uid)) {
      invalid.push({
        praktikanId: local.id,
        studentCode: expectedStudentCode,
        uid,
        reason: 'uid masih berupa placeholder, bukan Firebase Auth UID.',
      });
      return;
    }

    entries.push({
      praktikanId: local.id,
      praktikanName: local.name,
      studentCode: expectedStudentCode,
      uid,
    });
  });

  entries.sort((a, b) => numericLocalIdCompare(a.praktikanId, b.praktikanId));

  const praktikansByUid = new Map<string, string[]>();
  const praktikansByStudentCode = new Map<string, string[]>();

  entries.forEach((entry) => {
    addToIndex(praktikansByStudentCode, entry.studentCode, entry.praktikanId);
    if (!entry.uid) return;
    addToIndex(praktikansByUid, entry.uid, entry.praktikanId);
  });

  const duplicateUids = [...praktikansByUid.entries()]
    .filter(([, praktikanIds]) => praktikanIds.length > 1)
    .map(([uid, praktikanIds]) => ({
      value: uid,
      praktikanIds: [...praktikanIds].sort(numericLocalIdCompare),
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const duplicateStudentCodes = [...praktikansByStudentCode.entries()]
    .filter(([, praktikanIds]) => praktikanIds.length > 1)
    .map(([studentCode, praktikanIds]) => ({
      value: studentCode,
      praktikanIds: [...praktikanIds].sort(numericLocalIdCompare),
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const missingUids = entries.filter((entry) => !entry.uid);
  const missingLocalIds = praktikans
    .filter((praktikan) => !seenLocalIds.has(praktikan.id))
    .map((praktikan) => praktikan.id);

  return {
    format,
    totalLocalPraktikans: praktikans.length,
    entries,
    accounts: entries.map((entry) => ({
      uid: entry.uid,
      studentCode: entry.studentCode,
      name: entry.praktikanName,
    })),
    missingUids,
    missingLocalIds,
    unknownLocalIds: [...unknownLocalIds].sort(numericLocalIdCompare),
    invalid,
    duplicateStudentCodes,
    duplicateUids,
  };
}

function addToIndex(index: Map<string, string[]>, key: string, value: string): void {
  const values = index.get(key) ?? [];
  if (!values.includes(value)) {
    values.push(value);
  }
  index.set(key, values);
}
