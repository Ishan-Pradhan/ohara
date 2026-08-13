import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchQuizzes,
  fetchQuiz,
  generateQuiz,
  createQuiz,
  deleteQuiz,
  publishQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  fetchAttempts,
  fetchMyAttempt,
  submitAttempt,
  gradeShortAnswer,
  gradeAllShortAnswers,
  editShortAnswerGrade,
  type SubmitAttemptInput,
  type EditShortAnswerGradeInput,
} from './quizzes.api.js';
import type {
  GenerateQuizInput,
  CreateQuizInput,
  CreateQuestionInput,
  UpdateQuestionInput,
} from './quizzes.schema.js';

export const quizzesKey = (courseId: string, batchId?: string) =>
  ['quizzes', courseId, batchId ?? null] as const;
export const quizKey = (courseId: string, id: string) => ['quiz', courseId, id] as const;
export const attemptsKey = (courseId: string, quizId: string) =>
  ['quizAttempts', courseId, quizId] as const;
export const myAttemptKey = (courseId: string, quizId: string) =>
  ['myQuizAttempt', courseId, quizId] as const;

export const useQuizzes = (courseId: string, batchId?: string) =>
  useQuery({
    queryKey: quizzesKey(courseId, batchId),
    queryFn: () => fetchQuizzes(courseId, batchId),
    enabled: Boolean(courseId),
  });

export const useQuiz = (courseId: string, id: string) =>
  useQuery({
    queryKey: quizKey(courseId, id),
    queryFn: () => fetchQuiz(courseId, id),
    enabled: Boolean(courseId) && Boolean(id),
  });

// Mutations only ever touch the current batch (see resolveBatchForCourse in
// courses.controller.ts — you can't create/edit/delete onto a past batch),
// but invalidate the whole ['quizzes', courseId] prefix regardless of
// batchId, so any cached historical view for this course also refreshes.
export const useGenerateQuiz = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateQuizInput) => generateQuiz(courseId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quizzes', courseId] }),
  });
};

export const useCreateQuiz = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuizInput) => createQuiz(courseId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quizzes', courseId] }),
  });
};

export const useDeleteQuiz = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuiz(courseId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quizzes', courseId] }),
  });
};

export const usePublishQuiz = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'published' }) =>
      publishQuiz(courseId, id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['quizzes', courseId] });
      qc.invalidateQueries({ queryKey: quizKey(courseId, id) });
    },
  });
};

export const useCreateQuestion = (courseId: string, quizId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuestionInput) => createQuestion(courseId, quizId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKey(courseId, quizId) }),
  });
};

export const useUpdateQuestion = (courseId: string, quizId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateQuestionInput }) =>
      updateQuestion(courseId, quizId, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKey(courseId, quizId) }),
  });
};

export const useDeleteQuestion = (courseId: string, quizId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuestion(courseId, quizId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: quizKey(courseId, quizId) }),
  });
};

export const useAttempts = (courseId: string, quizId: string) =>
  useQuery({
    queryKey: attemptsKey(courseId, quizId),
    queryFn: () => fetchAttempts(courseId, quizId),
    enabled: Boolean(courseId) && Boolean(quizId),
  });

export const useMyAttempt = (courseId: string, quizId: string) =>
  useQuery({
    queryKey: myAttemptKey(courseId, quizId),
    queryFn: () => fetchMyAttempt(courseId, quizId),
    enabled: Boolean(courseId) && Boolean(quizId),
  });

export const useSubmitAttempt = (courseId: string, quizId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitAttemptInput) => submitAttempt(courseId, quizId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myAttemptKey(courseId, quizId) });
      // Answers only reveal once attempted — refetch the quiz itself too.
      qc.invalidateQueries({ queryKey: quizKey(courseId, quizId) });
    },
  });
};

export const useGradeShortAnswer = (courseId: string, quizId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, questionId }: { attemptId: string; questionId: string }) =>
      gradeShortAnswer(courseId, quizId, attemptId, questionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: attemptsKey(courseId, quizId) }),
  });
};

export const useGradeAllShortAnswers = (courseId: string, quizId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gradeAllShortAnswers(courseId, quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: attemptsKey(courseId, quizId) }),
  });
};

export const useEditShortAnswerGrade = (courseId: string, quizId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      questionId,
      input,
    }: {
      attemptId: string;
      questionId: string;
      input: EditShortAnswerGradeInput;
    }) => editShortAnswerGrade(courseId, quizId, attemptId, questionId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: attemptsKey(courseId, quizId) }),
  });
};
