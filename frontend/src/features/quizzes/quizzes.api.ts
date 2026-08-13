import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  quizSchema,
  questionSchema,
  quizAttemptSchema,
  shortAnswerGradeSchema,
  type Quiz,
  type Question,
  type QuizAttempt,
  type ShortAnswerGrade,
  type GenerateQuizInput,
  type CreateQuizInput,
  type CreateQuestionInput,
  type UpdateQuestionInput,
} from './quizzes.schema.js';

// batchId omitted -> the course's current batch. Given -> a specific past
// batch's quizzes (viewing completed-course history).
export const fetchQuizzes = async (courseId: string, batchId?: string): Promise<Quiz[]> => {
  const res = await api.get(`/courses/${courseId}/quizzes`, { params: batchId ? { batchId } : undefined });
  return z.array(quizSchema).parse(res.data.data);
};

export const fetchQuiz = async (courseId: string, id: string): Promise<Quiz> => {
  const res = await api.get(`/courses/${courseId}/quizzes/${id}`);
  return quizSchema.parse(res.data.data);
};

export const generateQuiz = async (courseId: string, input: GenerateQuizInput): Promise<Quiz> => {
  const res = await api.post(`/courses/${courseId}/quizzes/generate`, input);
  return quizSchema.parse(res.data.data);
};

export const createQuiz = async (courseId: string, input: CreateQuizInput): Promise<Quiz> => {
  const res = await api.post(`/courses/${courseId}/quizzes`, input);
  return quizSchema.parse(res.data.data);
};

export const deleteQuiz = async (courseId: string, id: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/quizzes/${id}`);
};

export const publishQuiz = async (
  courseId: string,
  id: string,
  status: 'draft' | 'published',
): Promise<void> => {
  await api.patch(`/courses/${courseId}/quizzes/${id}/publish`, { status });
};

export const createQuestion = async (
  courseId: string,
  quizId: string,
  input: CreateQuestionInput,
): Promise<Question> => {
  const res = await api.post(`/courses/${courseId}/quizzes/${quizId}/questions`, input);
  return questionSchema.parse(res.data.data);
};

export const updateQuestion = async (
  courseId: string,
  quizId: string,
  id: string,
  input: UpdateQuestionInput,
): Promise<Question> => {
  const res = await api.patch(`/courses/${courseId}/quizzes/${quizId}/questions/${id}`, input);
  return questionSchema.parse(res.data.data);
};

export const deleteQuestion = async (
  courseId: string,
  quizId: string,
  id: string,
): Promise<void> => {
  await api.delete(`/courses/${courseId}/quizzes/${quizId}/questions/${id}`);
};

export const fetchAttempts = async (courseId: string, quizId: string): Promise<QuizAttempt[]> => {
  const res = await api.get(`/courses/${courseId}/quizzes/${quizId}/attempts`);
  return z.array(quizAttemptSchema).parse(res.data.data);
};

export const fetchMyAttempt = async (courseId: string, quizId: string): Promise<QuizAttempt | null> => {
  const res = await api.get(`/courses/${courseId}/quizzes/${quizId}/attempts/me`);
  return quizAttemptSchema.nullable().parse(res.data.data);
};

export interface SubmitAttemptInput {
  responses: { questionId: string; answer: number | string }[];
}

export const submitAttempt = async (
  courseId: string,
  quizId: string,
  input: SubmitAttemptInput,
): Promise<QuizAttempt> => {
  const res = await api.post(`/courses/${courseId}/quizzes/${quizId}/attempts`, input);
  return quizAttemptSchema.parse(res.data.data);
};

export const gradeShortAnswer = async (
  courseId: string,
  quizId: string,
  attemptId: string,
  questionId: string,
): Promise<ShortAnswerGrade> => {
  const res = await api.post(
    `/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/questions/${questionId}/grade`,
  );
  return shortAnswerGradeSchema.parse(res.data.data);
};

export interface GradeAllShortAnswersResult {
  total: number;
  graded: number;
  failed: number;
  errors: { attemptId: string; questionId: string; error: string }[];
}

export const gradeAllShortAnswers = async (
  courseId: string,
  quizId: string,
): Promise<GradeAllShortAnswersResult> => {
  const res = await api.post(`/courses/${courseId}/quizzes/${quizId}/grade-short-answers`);
  return res.data.data as GradeAllShortAnswersResult;
};

export interface EditShortAnswerGradeInput {
  awardedPoints: number;
  feedback?: string | null;
  status?: 'draft' | 'approved';
}

export const editShortAnswerGrade = async (
  courseId: string,
  quizId: string,
  attemptId: string,
  questionId: string,
  input: EditShortAnswerGradeInput,
): Promise<ShortAnswerGrade> => {
  const res = await api.patch(
    `/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}/questions/${questionId}/grade`,
    input,
  );
  return shortAnswerGradeSchema.parse(res.data.data);
};
