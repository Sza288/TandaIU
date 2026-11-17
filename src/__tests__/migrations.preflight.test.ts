import { buildClassDocumentId } from '../migrations/classesSessions';
import { parseAccountTemplate } from '../migrations/accounts';
import {
  buildPreflightReport,
  buildSeedValidation,
} from '../migrations/preflight';
import { praktikans } from '../data/praktikans';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  runTransaction: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({ db: {} }));

const template = require('../../migration-accounts.example.json') as Record<
  string,
  { studentCode: string; uid: string }
>;

describe('seed session validation', () => {
  it('maps 12 seed sessions to 12 unique courseId + className classes', () => {
    const result = buildSeedValidation();

    expect(result.sessions).toHaveLength(12);
    expect(result.classes).toHaveLength(12);
    expect(result.duplicateSessionIds).toEqual([]);
    expect(result.duplicateClassPairs).toEqual([]);
    expect(result.invalidCourseIds).toEqual([]);
    expect(result.missingClassNames).toEqual([]);
    expect(new Set(result.sessions.map((session) => session.expectedClassId)).size).toBe(12);
    expect(result.sessions.every((session) => session.semester !== null)).toBe(true);

    result.sessions.forEach((session) => {
      expect(session.expectedClassId).toBe(
        buildClassDocumentId(session.courseId, session.className),
      );
    });
  });
});

describe('migration-accounts.example.json', () => {
  it('contains exactly the 31 local praktikan IDs and matching student codes', () => {
    const keys = Object.keys(template);
    const localById = new Map(praktikans.map((praktikan) => [praktikan.id, praktikan]));

    expect(keys).toHaveLength(31);
    expect(keys).toEqual(praktikans.map((praktikan) => praktikan.id));

    keys.forEach((key) => {
      const local = localById.get(key);
      expect(local).toBeDefined();
      expect(template[key].studentCode).toBe(local?.studentCode);
      expect(template[key].uid).toBe('');
    });
  });

  it('parses as a keyed template with 31 empty UID placeholders', () => {
    const report = parseAccountTemplate(template);

    expect(report.format).toBe('keyed');
    expect(report.entries).toHaveLength(31);
    expect(report.accounts).toHaveLength(31);
    expect(report.missingUids).toHaveLength(31);
    expect(report.missingLocalIds).toEqual([]);
    expect(report.unknownLocalIds).toEqual([]);
    expect(report.invalid).toEqual([]);
  });
});

describe('account template validation', () => {
  it('rejects unknown IDs, mismatched student codes, demo UIDs, and placeholders', () => {
    const report = parseAccountTemplate({
      p1: { studentCode: '24060124120002', uid: '' },
      p2: { studentCode: '24060124120002', uid: 'p2' },
      p3: { studentCode: '24060124120003', uid: '<UID_P3>' },
      p99: { studentCode: '24060124120099', uid: '' },
    });

    expect(report.entries).toHaveLength(0);
    expect(report.invalid).toHaveLength(4);
    expect(report.unknownLocalIds).toEqual(['p99']);
    expect(report.missingLocalIds).toContain('p4');
    expect(report.missingLocalIds).not.toContain('p1');
    expect(report.missingLocalIds).not.toContain('p2');
    expect(report.missingLocalIds).not.toContain('p3');
  });

  it('keeps accepting the legacy array and accounts-array formats', () => {
    const arrayReport = parseAccountTemplate([
      {
        praktikanId: 'p1',
        studentCode: '24060124120001',
        uid: '',
      },
    ]);
    const accountsReport = parseAccountTemplate({
      accounts: [{ studentCode: '24060124120001', uid: '' }],
    });

    expect(arrayReport.format).toBe('array');
    expect(arrayReport.entries).toHaveLength(1);
    expect(accountsReport.format).toBe('accounts-array');
    expect(accountsReport.entries).toHaveLength(1);
  });
});

describe('preflight report', () => {
  it('reports 69 enrollment targets and 31 missing mappings without a template', () => {
    const report = buildPreflightReport(null);

    expect(report.accountFormat).toBeNull();
    expect(report.accountEntries).toBe(0);
    expect(report.mappedUids).toBe(0);
    expect(report.targets).toHaveLength(12);
    expect(report.targetTotal).toBe(69);
    expect(report.targetIssues).toEqual([]);
    expect(report.expectedEnrollments).toBe(69);
    expect(report.readyEnrollments).toBe(0);
    expect(report.missingUids).toBe(31);
    expect(report.requiredMappings).toHaveLength(31);
    expect(report.missingLocalIds).toHaveLength(31);
    expect(report.blockers.some((blocker) => blocker.includes('firestore.rules'))).toBe(true);
  });

  it('reports a structurally valid template but no writable enrollment yet', () => {
    const report = buildPreflightReport(parseAccountTemplate(template));

    expect(report.accountFormat).toBe('keyed');
    expect(report.accountEntries).toBe(31);
    expect(report.accountInvalid).toBe(0);
    expect(report.missingLocalIds).toEqual([]);
    expect(report.mappedUids).toBe(0);
    expect(report.targetTotal).toBe(69);
    expect(report.targetIssues).toEqual([]);
    expect(report.expectedEnrollments).toBe(69);
    expect(report.readyEnrollments).toBe(0);
    expect(report.missingUids).toBe(31);
    expect(
      report.blockers.some((blocker) => blocker.includes('31 UID praktikan belum diisi')),
    ).toBe(true);
  });
});
