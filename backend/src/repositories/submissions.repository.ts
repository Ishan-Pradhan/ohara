import { Submission } from '../models/submissions.model.js';
import type {
  SubmissionAttributes,
  SubmissionCreationAttributes,
} from '../types/submissions.types.js';

export const submissionRepository = {
  create: async (data: SubmissionCreationAttributes): Promise<Submission> => {
    return await Submission.create(data);
  },

  findByAssignmentAndStudent: async (
    assignmentId: string,
    studentId: string,
  ): Promise<Submission | null> => {
    return await Submission.findOne({
      where: { assignmentId, studentId },
      include: ['grade'],
    });
  },

  findAllByAssignment: async (assignmentId: string): Promise<Submission[]> => {
    return await Submission.findAll({
      where: { assignmentId },
      include: ['student', 'grade'],
      order: [['submittedAt', 'ASC']],
    });
  },

  findById: async (id: string): Promise<Submission | null> => {
    return await Submission.findByPk(id, { include: ['student', 'grade'] });
  },

  update: async (
    id: string,
    data: Partial<
      Pick<
        SubmissionAttributes,
        | 'content'
        | 'fileUrl'
        | 'filePublicId'
        | 'fileOriginalName'
        | 'fileMimeType'
        | 'isLate'
        | 'submittedAt'
      >
    >,
  ): Promise<Submission | null> => {
    const submission = await Submission.findByPk(id);
    if (!submission) return null;
    return await submission.update(data);
  },
};
