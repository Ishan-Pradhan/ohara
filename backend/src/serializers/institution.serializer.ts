import type { Program } from '../models/programs.model.js';
import type { Class } from '../models/classes.model.js';
import type { AcademicYear } from '../models/academicYears.model.js';

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
