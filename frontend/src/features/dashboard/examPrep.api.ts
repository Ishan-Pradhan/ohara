import { api } from '../../lib/axios.js';
import { examPrepResponseSchema, type ExamPrepResponse } from './examPrep.schema.js';

export const fetchExamPrep = async (
  assessmentType: 'quiz' | 'assignment',
  assessmentId: string,
): Promise<ExamPrepResponse> => {
  const res = await api.get('/dashboard/me/exam-prep', {
    params: { assessmentType, assessmentId },
  });
  return examPrepResponseSchema.parse(res.data.data);
};
