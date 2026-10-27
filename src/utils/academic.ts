import { ACTIVE_ACADEMIC_TERM } from '../config/academicTerm';
import { courses } from '../data/courses';
import { praktikans } from '../data/praktikans';
import { AcademicTerm, PracticumCourse, Praktikan, Semester } from '../types';

export function getSemesterTerm(semester: Semester): AcademicTerm {
  return semester % 2 === 1 ? 'ganjil' : 'genap';
}

export function isSemesterInTerm(
  semester: Semester,
  term: AcademicTerm = ACTIVE_ACADEMIC_TERM
): boolean {
  return getSemesterTerm(semester) === term;
}

export function getPraktikanById(id: string | null): Praktikan | undefined {
  if (!id) return undefined;
  return praktikans.find((praktikan) => praktikan.id === id);
}

export function getActivePraktikans(
  term: AcademicTerm = ACTIVE_ACADEMIC_TERM
): Praktikan[] {
  return praktikans.filter((praktikan) => isSemesterInTerm(praktikan.semester, term));
}

export function isPraktikanActiveInTerm(
  id: string | null,
  term: AcademicTerm = ACTIVE_ACADEMIC_TERM
): boolean {
  const praktikan = getPraktikanById(id);
  return praktikan ? isSemesterInTerm(praktikan.semester, term) : false;
}

export function getCourseById(id: string): PracticumCourse | undefined {
  return courses.find((course) => course.id === id);
}

export function getCoursesForSemester(semester: Semester): PracticumCourse[] {
  return courses.filter((course) => course.semester === semester);
}

export function getCoursesForTerm(
  term: AcademicTerm = ACTIVE_ACADEMIC_TERM
): PracticumCourse[] {
  return courses.filter((course) => isSemesterInTerm(course.semester, term));
}

export function getCoursesForPraktikan(praktikanId: string): PracticumCourse[] {
  const praktikan = getPraktikanById(praktikanId);
  return praktikan ? getCoursesForSemester(praktikan.semester) : [];
}
