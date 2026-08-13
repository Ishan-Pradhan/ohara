import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import type { User } from '../models/users.model.js';
import { userRepository } from '../repositories/users.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { examMarkRepository } from '../repositories/examMarks.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { institutionProfileRepository } from '../repositories/institutionProfile.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { batchRepository } from '../repositories/batches.repository.js';
import { buildReportCard } from '../serializers/examMark.serializer.js';
import { generateReportCardPdf } from '../services/reportCardPdf.service.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const loadTranscript = async (studentId: string, caller: User) => {
  const student = await userRepository.findById(studentId);
  if (!student || student.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }

  const membership = await classMembershipRepository.findCurrent(studentId);
  if (!membership) {
    throw new ApiError(404, 'Student is not currently placed');
  }

  const isAdmin = caller.role === 'admin';
  const isSelf = caller.id === studentId;

  let marks = await examMarkRepository.findByStudent(studentId);

  if (!isAdmin && !isSelf) {
    if (caller.role !== 'teacher') {
      throw new ApiError(403, "Not authorized to view this student's transcript");
    }

    // Teacher: authorized only if they teach at least one course this
    // student is actively enrolled in, then scoped to just those courses'
    // marks.
    const [taught, enrollments] = await Promise.all([
      courseTeacherRepository.findByTeacherId(caller.id),
      enrollmentRepository.findAll({ studentId, batchId: membership.batchId }),
    ]);
    const taughtCourseIds = new Set(taught.map((t) => t.courseId));
    const isTeachingTeacher = enrollments.some((e) => taughtCourseIds.has(e.courseId));
    if (!isTeachingTeacher) {
      throw new ApiError(403, "Not authorized to view this student's transcript");
    }

    marks = marks.filter((m) => taughtCourseIds.has(m.courseId));
  }

  // Build per-semester metadata from the student's historical memberships
  const semesterMeta = new Map<string, { batchName: string | null; sectionName: string | null }>();
  const classIds = new Set(marks.map((m) => m.course?.classId).filter((id): id is string => Boolean(id)));
  const memberships = await classMembershipRepository.findAll({ studentId });

  for (const classId of classIds) {
    // Find the membership whose section's class matches this semester
    for (const m of memberships) {
      if (!m.sectionId) continue;
      const section = await sectionRepository.findById(m.sectionId);
      if (section?.classId !== classId) continue;

      const batch = m.batchId
        ? await batchRepository.findAll().then((batches) => batches.find((b) => b.id === m.batchId))
        : null;

      semesterMeta.set(classId, {
        batchName: batch?.name ?? null,
        sectionName: section?.name ?? null,
      });
      break;
    }
  }

  const { semesters, overallPercentage, overallGrade } = buildReportCard(marks, semesterMeta);

  return {
    student,
    membership,
    semesters,
    overallPercentage,
    overallGrade,
  };
};

export const getTranscript = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId } = req.validated?.params as { studentId: string };
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { student, membership, semesters, overallPercentage, overallGrade } = await loadTranscript(
      studentId,
      user,
    );

    return ok(res, {
      studentId: student.id,
      studentName: student.name,
      programName: membership.section?.class?.program?.name ?? '—',
      className: membership.section?.class?.name ?? '—',
      sectionName: membership.section?.name ?? '—',
      batchName: membership.batch?.name ?? '—',
      semesters,
      overallPercentage,
      overallGrade,
    }, 'Transcript retrieved');
  },
);

export const getTranscriptPdf = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId } = req.validated?.params as { studentId: string };
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { student, membership, semesters, overallPercentage, overallGrade } = await loadTranscript(
      studentId,
      user,
    );
    const institution = await institutionProfileRepository.get();

    const pdf = await generateReportCardPdf({
      institutionName: institution?.name ?? 'Ohara',
      studentName: student.name,
      programName: membership.section?.class?.program?.name ?? '—',
      className: membership.section?.class?.name ?? '—',
      sectionName: membership.section?.name ?? '—',
      batchName: membership.batch?.name ?? '—',
      semesters,
      overallPercentage,
      overallGrade,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transcript-${student.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`,
    );
    res.send(pdf);
  },
);
