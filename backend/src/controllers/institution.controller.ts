import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { ProgramCreationAttributes, ClassCreationAttributes, AcademicYearCreationAttributes, SectionCreationAttributes, CourseCreationAttributes } from '../types/institution.types.js';
import type { CourseTeacherCreationAttributes } from '../types/institution.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { serializeProgram, serializeClass, serializeAcademicYear, serializeSection, serializeCourse, serializeCourseTeacher } from '../serializers/institution.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { userRepository } from '../repositories/users.repository.js';

// ── PROGRAMS ────────────────────────────────────────────────────────────────

export const createProgram = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, institutionType, description } =
      req.validated?.body as ProgramCreationAttributes;

    const program = await programRepository.create({
      name,
      institutionType,
      description: description ?? null,
    });

    return ok(res, serializeProgram(program), 'Program created', 201);
  },
);

export const listPrograms = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const programs = await programRepository.findAll();
    return ok(res, programs.map(serializeProgram), 'Programs retrieved');
  },
);

// ── CLASSES ─────────────────────────────────────────────────────────────────

export const createClass = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { programId, name, orderIndex } =
      req.validated?.body as ClassCreationAttributes;

    const program = await programRepository.findById(programId);
    if (!program) {
      throw new ApiError(404, 'Program not found');
    }

    const cls = await classRepository.create({ programId, name, orderIndex });
    return ok(res, serializeClass(cls), 'Class created', 201);
  },
);

export const listClasses = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { programId } = req.validated?.query as { programId?: string };
    const classes = await classRepository.findAll({ programId });
    return ok(res, classes.map(serializeClass), 'Classes retrieved');
  },
);

// ── ACADEMIC YEARS ──────────────────────────────────────────────────────────

export const createAcademicYear = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, startDate, endDate, isCurrent } =
      req.validated?.body as AcademicYearCreationAttributes;

    const year = await academicYearRepository.create({
      name,
      startDate,
      endDate,
      isCurrent: isCurrent ?? false,
    });

    return ok(res, serializeAcademicYear(year), 'Academic year created', 201);
  },
);

export const listAcademicYears = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const years = await academicYearRepository.findAll();
    return ok(res, years.map(serializeAcademicYear), 'Academic years retrieved');
  },
);

// ── SECTIONS ─────────────────────────────────────────────────────────────────

export const createSection = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId, academicYearId, name, classTeacherId } =
      req.validated?.body as SectionCreationAttributes;

    const cls = await classRepository.findById(classId);
    if (!cls) {
      throw new ApiError(404, 'Class not found');
    }

    const year = await academicYearRepository.findById(academicYearId);
    if (!year) {
      throw new ApiError(404, 'Academic year not found');
    }

    if (classTeacherId) {
      const teacher = await userRepository.findById(classTeacherId);
      if (!teacher) {
        throw new ApiError(404, 'Teacher not found');
      }
      if (teacher.role !== 'teacher') {
        throw new ApiError(400, 'classTeacherId must reference a teacher');
      }
    }

    const section = await sectionRepository.create({
      classId,
      academicYearId,
      name,
      classTeacherId: classTeacherId ?? null,
    });

    return ok(res, serializeSection(section), 'Section created', 201);
  },
);

export const listSections = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId, academicYearId } = req.validated?.query as {
      classId?: string;
      academicYearId?: string;
    };
    const sections = await sectionRepository.findAll({ classId, academicYearId });
    return ok(res, sections.map(serializeSection), 'Sections retrieved');
  },
);

// ── COURSES ──────────────────────────────────────────────────────────────────

export const createCourse = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId, title, code, description } =
      req.validated?.body as CourseCreationAttributes;

    const cls = await classRepository.findById(classId);
    if (!cls) {
      throw new ApiError(404, 'Class not found');
    }

    const course = await courseRepository.create({
      classId,
      title,
      code,
      description: description ?? null,
    });

    return ok(res, serializeCourse(course), 'Course created', 201);
  },
);

export const listCourses = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId } = req.validated?.query as { classId?: string };
    const courses = await courseRepository.findAll({ classId });
    return ok(res, courses.map(serializeCourse), 'Courses retrieved');
  },
);

// ── COURSE TEACHERS ──────────────────────────────────────────────────────────

export const assignCourseTeacher = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { teacherId } =
      req.validated?.body as CourseTeacherCreationAttributes;

    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    const teacher = await userRepository.findById(teacherId);
    if (!teacher) {
      throw new ApiError(404, 'Teacher not found');
    }
    if (teacher.role !== 'teacher') {
      throw new ApiError(400, 'teacherId must reference a teacher');
    }

    const assignment = await courseTeacherRepository.assign({
      teacherId,
      courseId,
    });

    return ok(
      res,
      serializeCourseTeacher(assignment, teacher),
      'Teacher assigned',
      201,
    );
  },
);

export const listCourseTeachers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    const assignments = await courseTeacherRepository.findByCourseId(courseId);
    const withTeachers = await Promise.all(
      assignments.map(async (assignment) => {
        const teacher = await userRepository.findById(assignment.teacherId);
        // teacherId is enforced not-null and FK-constrained — a missing user
        // here would mean the DB is in an inconsistent state, not a normal
        // 404 case, so let it surface as a 500 rather than silently skipping.
        return serializeCourseTeacher(assignment, teacher!);
      }),
    );

    return ok(res, withTeachers, 'Course teachers retrieved');
  },
);
