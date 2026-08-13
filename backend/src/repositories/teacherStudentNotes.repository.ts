import { TeacherStudentNote } from '../models/teacherStudentNotes.model.js';
import type { TeacherStudentNoteCreationAttributes } from '../types/teacherStudentNotes.types.js';

export const teacherStudentNoteRepository = {
  create: async (data: TeacherStudentNoteCreationAttributes): Promise<TeacherStudentNote> => {
    return await TeacherStudentNote.create(data);
  },

  /** A teacher's own notes about one student — never another teacher's,
   * notes are private to whoever wrote them. */
  findByTeacherAndStudent: async (
    teacherId: string,
    studentId: string,
  ): Promise<TeacherStudentNote[]> => {
    return await TeacherStudentNote.findAll({
      where: { teacherId, studentId },
      order: [['createdAt', 'DESC']],
    });
  },

  findById: async (id: string): Promise<TeacherStudentNote | null> => {
    return await TeacherStudentNote.findByPk(id);
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await TeacherStudentNote.destroy({ where: { id } });
    return deleted > 0;
  },
};
