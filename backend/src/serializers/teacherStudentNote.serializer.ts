import type { TeacherStudentNote } from '../models/teacherStudentNotes.model.js';

export const serializeTeacherStudentNote = (n: TeacherStudentNote) => ({
  id: n.id,
  teacherId: n.teacherId,
  studentId: n.studentId,
  content: n.content,
  createdAt: n.createdAt,
});
