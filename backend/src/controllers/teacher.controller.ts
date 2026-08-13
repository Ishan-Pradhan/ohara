import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { User } from '../models/users.model.js';
import type { Course } from '../models/courses.model.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { programRepository } from '../repositories/programs.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { studentFlagRepository } from '../repositories/studentFlags.repository.js';
import { studentProfileRepository } from '../repositories/studentProfiles.repository.js';
import { serializeCourse, serializeSection } from '../serializers/institution.serializer.js';
import { serializeRosterStudent } from '../serializers/user.serializer.js';
import { serializeStudentFlag } from '../serializers/studentFlag.serializer.js';
import { buildAttendancePercentage } from '../serializers/attendance.serializer.js';
import { loadGradebook } from './gradebook.controller.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// ── MY COURSES ────────────────────────────────────────────────────────────

/** Shared by listMyCourses (self, any teacher) and admin.controller.ts's
 * getStaffCourses (admin looking up an arbitrary teacher by id) — same
 * per-course class/program/batch enrichment either way. */
export const loadTeacherCourses = async (teacherId: string) => {
  const assignments = await courseTeacherRepository.findByTeacherId(teacherId);
  const rawCourses = assignments
    .map((a) => a.course)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // Small N (a teacher's own course list), so a per-course class/program/batch
  // lookup is simpler than adding a bulk-join method for a one-place need.
  return await Promise.all(
    rawCourses.map(async (course) => {
      const cls = await classRepository.findById(course.classId);
      const program = cls ? await programRepository.findById(cls.programId) : null;

      // Find which batch(es) the enrolled students belong to for this course
      const enrollments = await enrollmentRepository.findByCourseWithStudents(course.id);
      const batchNames = new Set<string>();
      const sectionNames = new Set<string>();
      for (const enrollment of enrollments) {
        if (!enrollment.studentId) continue;
        const membership = await classMembershipRepository.findCurrent(enrollment.studentId);
        if (membership?.batch?.name) batchNames.add(membership.batch.name);
        if (membership?.section?.name) sectionNames.add(membership.section.name);
      }

      return {
        ...serializeCourse(course),
        classId: cls?.id ?? null,
        className: cls?.name ?? null,
        programId: program?.id ?? null,
        programName: program?.name ?? null,
        batchName: batchNames.size === 1 ? [...batchNames][0] : null,
        sectionName: sectionNames.size === 1 ? [...sectionNames][0] : null,
      };
    }),
  );
};

export const listMyCourses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const courses = await loadTeacherCourses(req.user!.id);
  return ok(res, courses, 'Courses retrieved');
});

// requireCourseTeacher already guards this route (admin or the assigned teacher).
export const listCourseStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
  const students = enrollments
    .map((e) => e.student)
    .filter((s): s is User => Boolean(s))
    .map(serializeRosterStudent);
  return ok(res, students, 'Roster retrieved');
});

// ── MY STUDENTS (every student across every course this teacher teaches) ────

/** Every one of this teacher's own courses a given student is actively
 * enrolled in — the ownership boundary for every teacher-facing per-student
 * view/action that isn't already scoped to one course (`requireCourseTeacher`
 * covers that case; this covers the cross-course "my students" surface).
 * Exported for teacherStudentNotes.controller.ts's identical ownership need. */
export const getSharedCourses = async (teacherId: string, studentId: string): Promise<Course[]> => {
  const assignments = await courseTeacherRepository.findByTeacherId(teacherId);
  const teacherCourses = assignments
    .map((a) => a.course)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const shared: Course[] = [];
  for (const course of teacherCourses) {
    if (await enrollmentRepository.isEnrolled(studentId, course.id)) {
      shared.push(course);
    }
  }
  return shared;
};

/** Every unique student across every course this teacher teaches, annotated
 * with their current program/class/section/batch (for the "group by
 * program" list view) and which of the teacher's own courses they share —
 * a student in more than one of this teacher's courses appears once, not
 * once per course. Small N (one teacher's own courses/rosters), same
 * reasoning as listMyCourses' per-course lookups above. */
export const listMyStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const assignments = await courseTeacherRepository.findByTeacherId(teacherId);
  const courses = assignments
    .map((a) => a.course)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const byStudentId = new Map<
    string,
    { student: User; courses: { id: string; title: string; code: string }[] }
  >();
  for (const course of courses) {
    const enrollments = await enrollmentRepository.findByCourseWithStudents(course.id);
    for (const enrollment of enrollments) {
      if (!enrollment.student) continue;
      const courseRef = { id: course.id, title: course.title, code: course.code };
      const existing = byStudentId.get(enrollment.studentId);
      if (existing) {
        existing.courses.push(courseRef);
      } else {
        byStudentId.set(enrollment.studentId, { student: enrollment.student, courses: [courseRef] });
      }
    }
  }

  const students = await Promise.all(
    [...byStudentId.values()].map(async ({ student, courses: sharedCourses }) => {
      const membership = await classMembershipRepository.findCurrent(student.id);
      return {
        ...serializeRosterStudent(student),
        programId: membership?.section?.class?.program?.id ?? null,
        programName: membership?.section?.class?.program?.name ?? null,
        className: membership?.section?.class?.name ?? null,
        sectionName: membership?.section?.name ?? null,
        batchName: membership?.batch?.name ?? null,
        courses: sharedCourses,
      };
    }),
  );

  return ok(res, students, 'Students retrieved');
});

/** A single student's profile, from this teacher's point of view — view-only,
 * scoped strictly to courses they actually share (403 otherwise, never a
 * quiet empty response, so a teacher can't probe for students outside their
 * own courses). Per-course grade + attendance summaries reuse the same
 * computations the gradebook/attendance endpoints already do for the whole
 * roster (loadGradebook, buildAttendancePercentage), just picking out this
 * one student's row instead of returning everyone's. Flags aren't
 * course-scoped in the model, so every flag ever raised for this student is
 * included (not just ones raised in a shared course) — still relevant
 * context for a teacher deciding how to support them. */
export const getMyStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const { studentId } = req.validated?.params as { studentId: string };

  const student = await userRepository.findById(studentId);
  if (!student || student.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }

  const sharedCourses = await getSharedCourses(teacherId, studentId);
  if (sharedCourses.length === 0) {
    throw new ApiError(403, 'This student is not in any of your courses');
  }

  const [membership, courseSummaries, flags, profile] = await Promise.all([
    classMembershipRepository.findCurrent(studentId),
    Promise.all(
      sharedCourses.map(async (course) => {
        const gradebook = await loadGradebook(course.id);
        const gradeRow = gradebook.rows.find((r) => r.studentId === studentId) ?? null;
        const records = await attendanceRecordRepository.findByStudentAndCourse(studentId, course.id);
        return {
          courseId: course.id,
          courseTitle: course.title,
          courseCode: course.code,
          grade: gradeRow,
          attendance: buildAttendancePercentage(records.map((r) => ({ status: r.status }))),
        };
      }),
    ),
    studentFlagRepository.findByStudentId(studentId),
    studentProfileRepository.findByUserId(studentId),
  ]);

  return ok(
    res,
    {
      ...serializeRosterStudent(student),
      programId: membership?.section?.class?.program?.id ?? null,
      programName: membership?.section?.class?.program?.name ?? null,
      className: membership?.section?.class?.name ?? null,
      sectionName: membership?.section?.name ?? null,
      batchName: membership?.batch?.name ?? null,
      // Populated lazily by the admission form (or the student's own
      // self-service edit) — null until at least one field has ever been provided.
      dateOfBirth: profile?.dateOfBirth ?? null,
      address: profile?.address ?? null,
      studentPhone: profile?.studentPhone ?? null,
      parentName: profile?.parentName ?? null,
      parentPhone: profile?.parentPhone ?? null,
      previousSchool: profile?.previousSchool ?? null,
      courses: courseSummaries,
      flags: flags.map(serializeStudentFlag),
    },
    'Student retrieved',
  );
});

// ── MY SECTION (class teacher only) ─────────────────────────────────────────

export const getMySection = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const sections = await sectionRepository.findByClassTeacherId(teacherId);

  const withContext = await Promise.all(
    sections.map(async (section) => {
      const cls = await classRepository.findById(section.classId);
      const program = cls ? await programRepository.findById(cls.programId) : null;
      return {
        ...serializeSection(section),
        className: cls?.name ?? null,
        programName: program?.name ?? null,
      };
    }),
  );

  return ok(res, withContext, 'Section retrieved');
});

export const listSectionStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sectionId } = req.validated?.params as { sectionId: string };
  const user = req.user!;

  const section = await sectionRepository.findById(sectionId);
  if (!section) {
    throw new ApiError(404, 'Section not found');
  }
  if (user.role !== 'admin' && section.classTeacherId !== user.id) {
    throw new ApiError(403, 'Not authorized for this section');
  }

  const memberships = await classMembershipRepository.findBySectionWithStudents(sectionId);
  const students = memberships
    .map((m) => m.student)
    .filter((s): s is User => Boolean(s))
    .map(serializeRosterStudent);
  return ok(res, students, 'Roster retrieved');
});
