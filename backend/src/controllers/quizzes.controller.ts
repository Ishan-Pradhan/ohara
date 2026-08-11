import type { Response } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { questionRepository } from '../repositories/questions.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { lessonRepository } from '../repositories/lessons.repository.js';
import { moduleRepository } from '../repositories/modules.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import { serializeQuiz, serializeQuestion } from '../serializers/quizzes.serializer.js';
import { generateJson } from '../services/llm.service.js';
import {
  quizGenerationSystemPrompt,
  quizGenerationUserPrompt,
  quizGenerationCorrectivePrompt,
} from '../prompts/quizGeneration.prompt.js';
import type { QuizGenerationOptions } from '../prompts/quizGeneration.prompt.js';
import { generatedQuizSchema } from '../validations/quizzes.validation.js';
import { QUIZ_STATUS } from '../constants/index.js';
import type { Quiz } from '../models/quizzes.model.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const findOwnedQuiz = async (courseId: string, id: string, includeQuestions = false): Promise<Quiz> => {
  const quiz = await quizRepository.findById(id, includeQuestions);
  if (!quiz || quiz.courseId !== courseId) {
    throw new ApiError(404, 'Quiz not found');
  }
  return quiz;
};

// ── AI generation ────────────────────────────────────────────────────────────

const tryParseQuiz = (raw: string) => {
  try {
    const json: unknown = JSON.parse(raw);
    return generatedQuizSchema.safeParse(json);
  } catch {
    return { success: false as const };
  }
};

/** Same bounded call-parse-retry shape as courseContent.controller.ts and
 * submissions.controller.ts's AI grading. */
const generateQuestions = async (
  sourceText: string,
  opts: QuizGenerationOptions,
) => {
  const systemPrompt = quizGenerationSystemPrompt(opts);
  const userPrompt = quizGenerationUserPrompt(sourceText);
  const raw = await generateJson(systemPrompt, userPrompt);

  let parsed = tryParseQuiz(raw);
  if (!parsed.success) {
    const retryRaw = await generateJson(systemPrompt, quizGenerationCorrectivePrompt(raw));
    parsed = tryParseQuiz(retryRaw);
  }
  if (!parsed.success) {
    throw new ApiError(502, 'The LLM could not produce a valid quiz after a retry');
  }
  return parsed.data.questions;
};

export const generateQuiz = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const {
      title, lessonId, lessonIds, topic, numQuestions, types,
      difficulty, cognitiveDistribution, pointsPerQuestion, learningObjectives,
    } = req.validated?.body as {
      title: string;
      lessonId?: string;
      lessonIds?: string[];
      topic?: string;
      numQuestions: number;
      types: string[];
      difficulty?: string;
      cognitiveDistribution?: Record<string, number>;
      pointsPerQuestion?: number;
      learningObjectives?: string[];
    };

    // Resolve source text from lesson(s) or topic
    const allLessonIds = lessonIds ?? (lessonId ? [lessonId] : []);
    let sourceText = topic ?? '';
    if (allLessonIds.length > 0) {
      const contents: string[] = [];
      for (const lid of allLessonIds) {
        const lesson = await lessonRepository.findById(lid);
        if (!lesson) {
          throw new ApiError(400, `Lesson ${lid} not found`);
        }
        const module = await moduleRepository.findById(lesson.moduleId);
        if (!module || module.courseId !== courseId) {
          throw new ApiError(400, `Lesson ${lid} does not belong to this course`);
        }
        contents.push(lesson.content);
      }
      sourceText = contents.join('\n\n---\n\n');
    }

    const generated = await generateQuestions(sourceText, {
      numQuestions,
      allowedTypes: types,
      difficulty,
      cognitiveDistribution,
      pointsPerQuestion,
      learningObjectives,
    });

    const quiz = await sequelize.transaction(async (transaction) => {
      const createdQuiz = await quizRepository.create({ courseId, title });
      const questions = [];
      for (const [index, q] of generated.entries()) {
        questions.push(
          await questionRepository.create(
            {
              quizId: createdQuiz.id,
              type: q.type,
              prompt: q.prompt,
              options: q.type === 'mcq' ? q.options : null,
              answer: q.type === 'mcq' ? { correctIndex: q.correctIndex } : null,
              points: q.points ?? pointsPerQuestion ?? 1,
              orderIndex: index,
              difficulty: q.difficulty ?? null,
              cognitiveLevel: q.cognitiveLevel ?? null,
            },
            transaction,
          ),
        );
      }
      createdQuiz.questions = questions;
      return createdQuiz;
    });

    return ok(res, serializeQuiz(quiz, true), 'Quiz generated', 201);
  },
);

// ── Quiz CRUD ────────────────────────────────────────────────────────────────

export const createQuiz = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { title } = req.validated?.body as { title: string };

    const quiz = await quizRepository.create({ courseId, title });
    quiz.questions = [];
    return ok(res, serializeQuiz(quiz, true), 'Quiz created', 201);
  },
);

export const listQuizzes = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const isStudent = req.user?.role === 'student';
    const quizzes = await quizRepository.findAllByCourse(
      courseId,
      isStudent ? QUIZ_STATUS.PUBLISHED : undefined,
    );
    return ok(res, quizzes.map((q) => serializeQuiz(q, true)), 'Quizzes retrieved');
  },
);

export const getQuiz = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const quiz = await findOwnedQuiz(courseId, id, true);

    const isStudent = req.user?.role === 'student';
    if (isStudent && quiz.status !== QUIZ_STATUS.PUBLISHED) {
      throw new ApiError(404, 'Quiz not found');
    }

    // A student sees answers only once they've submitted an attempt —
    // otherwise the quiz would be pointless. Teachers/admins always see them.
    let revealAnswers = !isStudent;
    if (isStudent && req.user) {
      const attempt = await quizAttemptRepository.findByQuizAndStudent(id, req.user.id);
      revealAnswers = attempt !== null;
    }

    return ok(res, serializeQuiz(quiz, revealAnswers), 'Quiz retrieved');
  },
);

export const updateQuiz = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const body = req.validated?.body as { title?: string };

    await findOwnedQuiz(courseId, id);
    const quiz = await quizRepository.update(id, body);
    if (!quiz) {
      throw new ApiError(404, 'Quiz not found');
    }
    return ok(res, serializeQuiz(quiz, true), 'Quiz updated');
  },
);

export const deleteQuiz = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    await findOwnedQuiz(courseId, id);
    await quizRepository.delete(id);
    return ok(res, null, 'Quiz deleted');
  },
);

export const publishQuiz = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const { status } = req.validated?.body as { status: 'draft' | 'published' };

    const before = await findOwnedQuiz(courseId, id);
    const quiz = await quizRepository.setStatus(id, status);
    if (!quiz) {
      throw new ApiError(404, 'Quiz not found');
    }

    if (before.status !== QUIZ_STATUS.PUBLISHED && quiz.status === QUIZ_STATUS.PUBLISHED) {
      const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
      await notificationRepository.bulkCreate(
        enrollments.map((e) => ({
          userId: e.studentId,
          type: 'quiz_published' as const,
          title: `New quiz available: ${quiz.title}`,
          body: null,
          link: `/student/courses/${courseId}/quizzes/${quiz.id}`,
        })),
      );
    }

    return ok(res, { id: quiz.id, status: quiz.status }, 'Quiz publish state updated');
  },
);

// ── Questions (manual authoring on top of AI generation) ───────────────────

const findOwnedQuestion = async (quizId: string, id: string) => {
  const question = await questionRepository.findById(id);
  if (!question || question.quizId !== quizId) {
    throw new ApiError(404, 'Question not found');
  }
  return question;
};

export const createQuestion = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, quizId } = req.validated?.params as { courseId: string; quizId: string };
    const body = req.validated?.body as
      | { type: 'mcq'; prompt: string; options: string[]; correctIndex: number; points: number; orderIndex: number }
      | { type: 'short_answer'; prompt: string; points: number; orderIndex: number };

    await findOwnedQuiz(courseId, quizId);

    const question = await questionRepository.create({
      quizId,
      type: body.type,
      prompt: body.prompt,
      options: body.type === 'mcq' ? body.options : null,
      answer: body.type === 'mcq' ? { correctIndex: body.correctIndex } : null,
      points: body.points,
      orderIndex: body.orderIndex,
    });
    return ok(res, serializeQuestion(question, true), 'Question added', 201);
  },
);

export const updateQuestion = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, quizId, id } = req.validated?.params as {
      courseId: string;
      quizId: string;
      id: string;
    };
    const body = req.validated?.body as {
      prompt?: string;
      options?: string[];
      correctIndex?: number;
      points?: number;
      orderIndex?: number;
    };

    await findOwnedQuiz(courseId, quizId);
    await findOwnedQuestion(quizId, id);

    const question = await questionRepository.update(id, {
      ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
      ...(body.options !== undefined ? { options: body.options } : {}),
      ...(body.correctIndex !== undefined ? { answer: { correctIndex: body.correctIndex } } : {}),
      ...(body.points !== undefined ? { points: body.points } : {}),
      ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
    });
    if (!question) {
      throw new ApiError(404, 'Question not found');
    }
    return ok(res, serializeQuestion(question, true), 'Question updated');
  },
);

export const deleteQuestion = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, quizId, id } = req.validated?.params as {
      courseId: string;
      quizId: string;
      id: string;
    };
    await findOwnedQuiz(courseId, quizId);
    await findOwnedQuestion(quizId, id);
    await questionRepository.delete(id);
    return ok(res, null, 'Question deleted');
  },
);
