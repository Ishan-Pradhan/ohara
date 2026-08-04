import { programRepository } from '../../src/repositories/programs.repository.js';
import { classRepository } from '../../src/repositories/classes.repository.js';
import { academicYearRepository } from '../../src/repositories/academicYears.repository.js';
import { sectionRepository } from '../../src/repositories/sections.repository.js';
import { courseRepository } from '../../src/repositories/courses.repository.js';
import { userRepository } from '../../src/repositories/users.repository.js';
import { enrollmentRepository } from '../../src/repositories/enrollments.repository.js';
import type { Program } from '../../src/models/programs.model.js';
import type { Class } from '../../src/models/classes.model.js';
import type { AcademicYear } from '../../src/models/academicYears.model.js';
import type { Section } from '../../src/models/sections.model.js';
import type { Course } from '../../src/models/courses.model.js';
import type { Enrollment } from '../../src/models/enrollments.model.js';
import type { InstitutionType, CourseType } from '../../src/types/institution.types.js';
import { hashPassword } from '../../src/utils/security.utils.js';

export const createProgram = async (
  overrides: Partial<{
    name: string;
    institutionType: InstitutionType;
    description: string | null;
  }> = {},
): Promise<Program> => {
  return programRepository.create({
    name: overrides.name ?? 'Test Program',
    institutionType: overrides.institutionType ?? 'school',
    description: overrides.description ?? null,
  });
};

export const createClass = async (
  overrides: Partial<{ programId: string; name: string; orderIndex: number }> = {},
): Promise<Class> => {
  const programId = overrides.programId ?? (await createProgram()).id;

  return classRepository.create({
    programId,
    name: overrides.name ?? 'Test Class',
    orderIndex: overrides.orderIndex ?? 1,
  });
};

export const createAcademicYear = async (
  overrides: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }> = {},
): Promise<AcademicYear> => {
  return academicYearRepository.create({
    name: overrides.name ?? '2025-2026',
    startDate: overrides.startDate ?? '2025-06-01',
    endDate: overrides.endDate ?? '2026-05-31',
    isCurrent: overrides.isCurrent ?? false,
  });
};

/** A verified teacher-role user, for classTeacherId / course_teachers fixtures. */
export const createTeacherUser = async (
  overrides: Partial<{ name: string; email: string }> = {},
) => {
  return userRepository.create({
    name: overrides.name ?? 'Test Teacher',
    email: overrides.email ?? `teacher-${Date.now()}-${Math.random()}@example.com`,
    password: await hashPassword('hunter2secret'),
    role: 'teacher',
    isVerified: true,
  });
};

export const createSection = async (
  overrides: Partial<{
    classId: string;
    academicYearId: string;
    classTeacherId: string | null;
    name: string;
  }> = {},
): Promise<Section> => {
  const classId = overrides.classId ?? (await createClass()).id;
  const academicYearId =
    overrides.academicYearId ?? (await createAcademicYear()).id;

  return sectionRepository.create({
    classId,
    academicYearId,
    classTeacherId: overrides.classTeacherId ?? null,
    name: overrides.name ?? 'A',
  });
};

/** A verified student-role user, mirrors createTeacherUser. */
export const createStudentUser = async (
  overrides: Partial<{ name: string; email: string }> = {},
) => {
  return userRepository.create({
    name: overrides.name ?? 'Test Student',
    email: overrides.email ?? `student-${Date.now()}-${Math.random()}@example.com`,
    password: await hashPassword('hunter2secret'),
    role: 'student',
    isVerified: true,
  });
};

export const createCourse = async (
  overrides: Partial<{
    classId: string;
    title: string;
    code: string;
    description: string | null;
    courseType: CourseType;
  }> = {},
): Promise<Course> => {
  const classId = overrides.classId ?? (await createClass()).id;

  return courseRepository.create({
    classId,
    title: overrides.title ?? 'Physics',
    code: overrides.code ?? `PHYS-${Date.now()}-${Math.random()}`,
    description: overrides.description ?? null,
    courseType: overrides.courseType ?? 'compulsory',
  });
};

export const createEnrollment = async (
  overrides: Partial<{ studentId: string; courseId: string; academicYearId: string }> = {},
): Promise<Enrollment> => {
  const academicYearId = overrides.academicYearId ?? (await createAcademicYear()).id;
  const courseId = overrides.courseId ?? (await createCourse()).id;
  const studentId = overrides.studentId ?? (await createStudentUser()).id;

  return enrollmentRepository.create({ studentId, courseId, academicYearId });
};
