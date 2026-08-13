import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { teacherStudentNoteRepository } from '../repositories/teacherStudentNotes.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { serializeTeacherStudentNote } from '../serializers/teacherStudentNote.serializer.js';
import { getSharedCourses } from './teacher.controller.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** Notes are private to the teacher who wrote them and only make sense in
 * the context of a student the teacher actually teaches — every handler
 * here re-checks getSharedCourses rather than trusting the student was
 * reachable once (a teacher could lose the shared course between visits to
 * this student's profile). */
const assertSharedStudent = async (teacherId: string, studentId: string) => {
  const student = await userRepository.findById(studentId);
  if (!student || student.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }
  const sharedCourses = await getSharedCourses(teacherId, studentId);
  if (sharedCourses.length === 0) {
    throw new ApiError(403, 'This student is not in any of your courses');
  }
};

export const listMyStudentNotes = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const { studentId } = req.validated?.params as { studentId: string };

  await assertSharedStudent(teacherId, studentId);

  const notes = await teacherStudentNoteRepository.findByTeacherAndStudent(teacherId, studentId);
  return ok(res, notes.map(serializeTeacherStudentNote), 'Notes retrieved');
});

export const createMyStudentNote = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const { studentId } = req.validated?.params as { studentId: string };
  const { content } = req.validated?.body as { content: string };

  await assertSharedStudent(teacherId, studentId);

  const note = await teacherStudentNoteRepository.create({ teacherId, studentId, content });
  return ok(res, serializeTeacherStudentNote(note), 'Note added', 201);
});

export const deleteMyStudentNote = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const { noteId } = req.validated?.params as { studentId: string; noteId: string };

  const note = await teacherStudentNoteRepository.findById(noteId);
  if (!note || note.teacherId !== teacherId) {
    throw new ApiError(404, 'Note not found');
  }

  await teacherStudentNoteRepository.delete(noteId);
  return ok(res, null, 'Note deleted');
});
