import type { StudentFlag } from '../models/studentFlags.model.js';
import type { User } from '../models/users.model.js';

export const serializeStudentFlag = (f: StudentFlag) => ({
  id: f.id,
  studentId: f.studentId,
  raisedBy: f.raisedBy,
  raisedByName: (f.raiser as User | undefined)?.name ?? null,
  courseId: f.courseId,
  sectionId: f.sectionId,
  reason: f.reason,
  status: f.status,
  createdAt: f.createdAt,
});
