import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { ProgramCreationAttributes, ClassCreationAttributes, AcademicYearCreationAttributes, SectionCreationAttributes, CourseCreationAttributes } from '../types/institution.types.js';
import type { CourseTeacherCreationAttributes, BatchCreationAttributes } from '../types/institution.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { batchRepository } from '../repositories/batches.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { serializeProgram, serializeBatch, serializeClass, serializeAcademicYear, serializeSection, serializeCourse, serializeCourseTeacher } from '../serializers/institution.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { userRepository } from '../repositories/users.repository.js';

// ── PROGRAMS ────────────────────────────────────────────────────────────────

export const createProgram = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, institutionType, description, affiliation } =
      req.validated?.body as ProgramCreationAttributes;

    const program = await programRepository.create({
      name,
      institutionType,
      description: description ?? null,
      affiliation: affiliation ?? null,
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

export const updateProgram = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as Partial<
      Pick<
        ProgramCreationAttributes,
        'name' | 'institutionType' | 'description' | 'affiliation'
      >
    >;

    const program = await programRepository.update(id, body);
    if (!program) {
      throw new ApiError(404, 'Program not found');
    }

    return ok(res, serializeProgram(program), 'Program updated');
  },
);

export const deleteProgram = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const deleted = await programRepository.delete(id);
    if (!deleted) {
      throw new ApiError(404, 'Program not found');
    }

    return ok(res, null, 'Program deleted');
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

export const updateClass = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as Partial<
      Pick<ClassCreationAttributes, 'name' | 'orderIndex'>
    >;

    const cls = await classRepository.update(id, body);
    if (!cls) {
      throw new ApiError(404, 'Class not found');
    }

    return ok(res, serializeClass(cls), 'Class updated');
  },
);

export const deleteClass = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const deleted = await classRepository.delete(id);
    if (!deleted) {
      throw new ApiError(404, 'Class not found');
    }

    return ok(res, null, 'Class deleted');
  },
);

// ── BATCHES ─────────────────────────────────────────────────────────────────

export const createBatch = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { programId, name, startAcademicYearId } =
      req.validated?.body as BatchCreationAttributes;

    const program = await programRepository.findById(programId);
    if (!program) {
      throw new ApiError(404, 'Program not found');
    }

    const year = await academicYearRepository.findById(startAcademicYearId);
    if (!year) {
      throw new ApiError(404, 'Academic year not found');
    }

    const batch = await batchRepository.create({ programId, name, startAcademicYearId });
    return ok(res, serializeBatch(batch), 'Batch created', 201);
  },
);

export const listBatches = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { programId } = req.validated?.query as { programId?: string };
    const batches = await batchRepository.findAll({ programId });
    return ok(res, batches.map(serializeBatch), 'Batches retrieved');
  },
);

export const updateBatch = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as Partial<Pick<BatchCreationAttributes, 'name'>>;

    const batch = await batchRepository.update(id, body);
    if (!batch) {
      throw new ApiError(404, 'Batch not found');
    }

    return ok(res, serializeBatch(batch), 'Batch updated');
  },
);

export const deleteBatch = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const deleted = await batchRepository.delete(id);
    if (!deleted) {
      throw new ApiError(404, 'Batch not found');
    }

    return ok(res, null, 'Batch deleted');
  },
);

// ── ACADEMIC YEARS ──────────────────────────────────────────────────────────

export const createAcademicYear = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, startDate, endDate, isCurrent, term } =
      req.validated?.body as AcademicYearCreationAttributes;

    const year = await academicYearRepository.create({
      name,
      startDate,
      endDate,
      isCurrent: isCurrent ?? false,
      term,
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

export const updateAcademicYear = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as Partial<
      Pick<AcademicYearCreationAttributes, 'name' | 'startDate' | 'endDate' | 'isCurrent' | 'term'>
    >;

    const year = await academicYearRepository.update(id, body);
    if (!year) {
      throw new ApiError(404, 'Academic year not found');
    }

    return ok(res, serializeAcademicYear(year), 'Academic year updated');
  },
);

export const deleteAcademicYear = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const deleted = await academicYearRepository.delete(id);
    if (!deleted) {
      throw new ApiError(404, 'Academic year not found');
    }

    return ok(res, null, 'Academic year deleted');
  },
);

// ── SECTIONS ─────────────────────────────────────────────────────────────────

export const createSection = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId, academicYearId, name, classTeacherId, capacity } =
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
      capacity: capacity ?? null,
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
    const counts = await classMembershipRepository.countBySections(sections.map((s) => s.id));
    return ok(
      res,
      sections.map((s) => serializeSection(s, counts[s.id] ?? 0)),
      'Sections retrieved',
    );
  },
);

export const updateSection = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as {
      name?: string;
      classTeacherId?: string | null;
      capacity?: number | null;
    };

    if (body.classTeacherId) {
      const teacher = await userRepository.findById(body.classTeacherId);
      if (!teacher) {
        throw new ApiError(404, 'Teacher not found');
      }
      if (teacher.role !== 'teacher') {
        throw new ApiError(400, 'classTeacherId must reference a teacher');
      }
    }

    const section = await sectionRepository.update(id, body);
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    return ok(res, serializeSection(section), 'Section updated');
  },
);

export const deleteSection = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const deleted = await sectionRepository.delete(id);
    if (!deleted) {
      throw new ApiError(404, 'Section not found');
    }

    return ok(res, null, 'Section deleted');
  },
);

// ── COURSES ──────────────────────────────────────────────────────────────────

export const createCourse = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId, title, code, description, courseType, capacity } =
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
      courseType,
      capacity: capacity ?? null,
    });

    // When a compulsory course is added after students are already placed,
    // auto-enroll every currently-active student in the class so they're not
    // missed. `ignoreDuplicates` is safe here — the enrollment table has a
    // UNIQUE(studentId, courseId, academicYearId) constraint, so any student
    // who somehow already has a row for this course is silently skipped.
    if (courseType === 'compulsory') {
      const sections = await sectionRepository.findAll({ classId });

      const enrollmentsToCreate = (
        await Promise.all(
          sections.map((section) =>
            classMembershipRepository.findBySectionWithStudents(section.id).then((memberships) =>
              memberships.map((m) => ({
                studentId: m.studentId,
                courseId: course.id,
                academicYearId: section.academicYearId,
              })),
            ),
          ),
        )
      ).flat();

      if (enrollmentsToCreate.length > 0) {
        await enrollmentRepository.bulkCreate(enrollmentsToCreate, undefined, true);
      }
    }

    return ok(res, serializeCourse(course), 'Course created', 201);
  },
);

export const listCourses = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { classId } = req.validated?.query as { classId?: string };
    const courses = await courseRepository.findAll({ classId });
    const counts = await enrollmentRepository.countByCourses(courses.map((c) => c.id));
    return ok(
      res,
      courses.map((c) => serializeCourse(c, counts[c.id] ?? 0)),
      'Courses retrieved',
    );
  },
);

export const updateCourse = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as Partial<
      Pick<CourseCreationAttributes, 'title' | 'code' | 'description' | 'capacity'>
    >;

    const course = await courseRepository.update(id, body);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    return ok(res, serializeCourse(course), 'Course updated');
  },
);

export const deleteCourse = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };

    const deleted = await courseRepository.delete(id);
    if (!deleted) {
      throw new ApiError(404, 'Course not found');
    }

    return ok(res, null, 'Course deleted');
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
