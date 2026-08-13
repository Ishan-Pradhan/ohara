import type { Optional } from 'sequelize';

export interface TeacherStudentNoteAttributes {
  id: string;
  teacherId: string;
  studentId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TeacherStudentNoteCreationAttributes = Optional<
  TeacherStudentNoteAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;
