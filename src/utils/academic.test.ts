import { ACTIVE_ACADEMIC_TERM } from '../config/academicTerm';
import {
  getActivePraktikans,
  getCourseById,
  getCoursesForPraktikan,
  getCoursesForSemester,
  getCoursesForTerm,
  getPraktikanById,
  getSemesterTerm,
  isPraktikanActiveInTerm,
  isSemesterInTerm,
} from './academic';

describe('academic term helpers (FR-01)', () => {
  it('maps odd semesters to ganjil and even semesters to genap', () => {
    expect(getSemesterTerm(1)).toBe('ganjil');
    expect(getSemesterTerm(3)).toBe('ganjil');
    expect(getSemesterTerm(5)).toBe('ganjil');
    expect(getSemesterTerm(2)).toBe('genap');
    expect(getSemesterTerm(4)).toBe('genap');
  });

  it('filters semesters against the active term', () => {
    expect(ACTIVE_ACADEMIC_TERM).toBe('ganjil');
    expect(isSemesterInTerm(3)).toBe(true);
    expect(isSemesterInTerm(2)).toBe(false);
  });
});

describe('praktikan identity helpers (AT-01 / AT-03 / AT-06)', () => {
  it('returns a praktikan by id and undefined for missing ids', () => {
    expect(getPraktikanById('p1')?.name).toBe('Andi Pratama');
    expect(getPraktikanById(null)).toBeUndefined();
    expect(getPraktikanById('ghost')).toBeUndefined();
  });

  it('returns only praktikans in the active semester', () => {
    const activePraktikans = getActivePraktikans();

    expect(activePraktikans.length).toBeGreaterThan(0);
    expect(activePraktikans.every((praktikan) => isSemesterInTerm(praktikan.semester))).toBe(true);
    expect(activePraktikans.every((praktikan) => praktikan.semester % 2 === 1)).toBe(true);
  });

  it('checks whether a praktikan is active in the active term', () => {
    expect(isPraktikanActiveInTerm('p1')).toBe(true);
    expect(isPraktikanActiveInTerm('p4')).toBe(false);
    expect(isPraktikanActiveInTerm(null)).toBe(false);
  });
});

describe('course helpers (FR-02 / FR-03)', () => {
  it('returns a course by id', () => {
    expect(getCourseById('struktur-data')?.name).toBe('Struktur Data');
    expect(getCourseById('missing')).toBeUndefined();
  });

  it('returns courses for a specific semester', () => {
    expect(getCoursesForSemester(3).map((course) => course.id)).toEqual([
      'sistem-operasi',
      'struktur-data',
      'basis-data',
    ]);
  });

  it('returns courses for the active term', () => {
    expect(getCoursesForTerm('ganjil').map((course) => course.id)).toEqual([
      'dasar-pemrograman',
      'dasar-sistem',
      'sistem-operasi',
      'struktur-data',
      'basis-data',
      'pengembangan-platform-khusus',
      'pembelajaran-mesin',
    ]);
  });

  it('returns courses for a praktikan by their semester', () => {
    expect(getCoursesForPraktikan('p1').map((course) => course.id)).toEqual([
      'sistem-operasi',
      'struktur-data',
      'basis-data',
    ]);
  });
});
