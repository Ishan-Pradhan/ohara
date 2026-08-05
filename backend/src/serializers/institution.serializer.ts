import type { Program } from '../models/programs.model.js';
import type { Batch } from '../models/batches.model.js';
import type { Class } from '../models/classes.model.js';
import type { AcademicYear } from '../models/academicYears.model.js';
import type { Section } from '../models/sections.model.js';
import type { Course } from '../models/courses.model.js';
import type { CourseTeacher } from '../models/courseTeachers.model.js';
import type { User } from '../models/users.model.js';

export const serializeProgram = (p: Program) => ({
  id: p.id,
  name: p.name,
  institutionType: p.institutionType,
  description: p.description,
  affiliation: p.affiliation,
  createdAt: p.createdAt,
});

export const serializeBatch = (b: Batch) => ({
  id: b.id,
  programId: b.programId,
  name: b.name,
  startAcademicYearId: b.startAcademicYearId,
  createdAt: b.createdAt,
});

export const serializeClass = (c: Class) => ({
  id: c.id,
  programId: c.programId,
  name: c.name,
  orderIndex: c.orderIndex,
  createdAt: c.createdAt,
});

export const serializeAcademicYear = (y: AcademicYear) => ({
  id: y.id,
  name: y.name,
  startDate: y.startDate,
  endDate: y.endDate,
  isCurrent: y.isCurrent,
  createdAt: y.createdAt,
});

export const serializeSection = (s: Section, enrolledCount = 0) => ({
  id: s.id,
  classId: s.classId,
  academicYearId: s.academicYearId,
  classTeacherId: s.classTeacherId,
  name: s.name,
  capacity: s.capacity,
  enrolledCount,
  createdAt: s.createdAt,
});

export const serializeCourse = (c: Course, enrolledCount = 0) => ({
  id: c.id,
  classId: c.classId,
  title: c.title,
  code: c.code,
  description: c.description,
  isPublished: c.isPublished,
  courseType: c.courseType,
  capacity: c.capacity,
  enrolledCount,
  createdAt: c.createdAt,
});

export const serializeElectiveCourse = (
  c: Course,
  enrolledCount: number,
  isEnrolled: boolean,
) => ({
  id: c.id,
  classId: c.classId,
  title: c.title,
  code: c.code,
  description: c.description,
  capacity: c.capacity,
  enrolledCount,
  isEnrolled,
});

export const serializeCourseTeacher = (ct: CourseTeacher, teacher: User) => ({
  id: ct.id,
  courseId: ct.courseId,
  teacherId: ct.teacherId,
  teacherName: teacher.name,
  teacherEmail: teacher.email,
  createdAt: ct.createdAt,
});
