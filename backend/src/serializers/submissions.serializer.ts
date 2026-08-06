import type { Submission } from '../models/submissions.model.js';
import { serializeGrade } from './grades.serializer.js';
import { GRADE_STATUS } from '../constants/index.js';

// filePublicId is Cloudinary's internal asset id (needed only to delete/manage
// the file) — never returned to the client, same principle as
// documents.storageKey. `student` is only present when the caller
// (listSubmissions) actually loaded that association — the teacher roster
// view needs a name to display, not just studentId.
export const serializeSubmission = (s: Submission) => ({
  id: s.id,
  assignmentId: s.assignmentId,
  studentId: s.studentId,
  student: s.student ? { id: s.student.id, name: s.student.name, email: s.student.email } : undefined,
  content: s.content,
  fileUrl: s.fileUrl,
  fileOriginalName: s.fileOriginalName,
  isLate: s.isLate,
  submittedAt: s.submittedAt,
  createdAt: s.createdAt,
  grade: s.grade ? serializeGrade(s.grade) : null,
});

// A student never sees a draft AI grade (golden rule 6 / FR-29) — only an
// approved one. The submission itself is always visible either way.
export const serializeSubmissionForStudent = (s: Submission) => ({
  ...serializeSubmission(s),
  grade: s.grade && s.grade.status === GRADE_STATUS.APPROVED ? serializeGrade(s.grade) : null,
});
