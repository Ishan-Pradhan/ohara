import type { Program } from '../models/programs.model.js';
import type { Class } from '../models/classes.model.js';
import type { AcademicYear } from '../models/academicYears.model.js';
import type { Section } from '../models/sections.model.js';
import type { Course } from '../models/courses.model.js';

export const serializeProgram = (p: Program) => ({
  id: p.id,
  name: p.name,
  institutionType: p.institutionType,
  description: p.description,
  createdAt: p.createdAt,
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

export const serializeSection = (s: Section) => ({
  id: s.id,
  classId: s.classId,
  academicYearId: s.academicYearId,
  classTeacherId: s.classTeacherId,
  name: s.name,
  createdAt: s.createdAt,
});

export const serializeCourse = (c: Course) => ({
  id: c.id,
  classId: c.classId,
  title: c.title,
  code: c.code,
  description: c.description,
  createdAt: c.createdAt,
});
