import type { Quiz } from '../models/quizzes.model.js';
import type { Question } from '../models/questions.model.js';

// correctIndex is withheld unless the caller is authorized to see it (teacher/
// admin always; a student only after they've attempted the quiz) — decided
// by the controller, never by this function guessing at role.
export const serializeQuestion = (q: Question, revealAnswers: boolean) => ({
  id: q.id,
  quizId: q.quizId,
  type: q.type,
  prompt: q.prompt,
  options: q.options,
  correctIndex: revealAnswers ? (q.answer?.correctIndex ?? null) : null,
  points: q.points,
  orderIndex: q.orderIndex,
  difficulty: q.difficulty ?? null,
  cognitiveLevel: q.cognitiveLevel ?? null,
});

export const serializeQuiz = (quiz: Quiz, revealAnswers: boolean) => ({
  id: quiz.id,
  courseId: quiz.courseId,
  title: quiz.title,
  status: quiz.status,
  createdAt: quiz.createdAt,
  questions: quiz.questions?.map((q) => serializeQuestion(q, revealAnswers)),
});
