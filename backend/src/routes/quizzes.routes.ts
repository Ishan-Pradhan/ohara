import { Router } from 'express';
import {
  verifyJWT,
  requireCourseTeacher,
  requireEnrolledStudent,
  requireCourseAccess,
} from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { assignmentGradingLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  generateQuizSchema,
  createQuizSchema,
  listQuizzesSchema,
  getQuizSchema,
  updateQuizSchema,
  deleteQuizSchema,
  publishQuizSchema,
  createQuestionSchema,
  updateQuestionSchema,
  deleteQuestionSchema,
} from '../validations/quizzes.validation.js';
import {
  submitAttemptSchema,
  getMyAttemptSchema,
  listAttemptsSchema,
  gradeShortAnswerSchema,
  gradeAllShortAnswersSchema,
  editShortAnswerGradeSchema,
} from '../validations/quizAttempts.validation.js';
import {
  generateQuiz,
  createQuiz,
  listQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../controllers/quizzes.controller.js';
import {
  submitAttempt,
  getMyAttempt,
  listAttempts,
  gradeShortAnswer,
  gradeAllShortAnswers,
  editShortAnswerGrade,
} from '../controllers/quizAttempts.controller.js';

// Mounted at /api/v1/courses — see documents.routes.ts for why this isn't
// under /api/v1/admin, and app.ts for why it must be registered before
// electivesRoutes.
const router = Router();

// LLM-backed — same limiter tier as AI grading (NFR-3/NFR-8).
router
  .route('/:courseId/quizzes/generate')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(generateQuizSchema),
    generateQuiz,
  );

router
  .route('/:courseId/quizzes')
  .post(verifyJWT, requireCourseTeacher, validate(createQuizSchema), createQuiz)
  .get(verifyJWT, requireCourseAccess, validate(listQuizzesSchema), listQuizzes);

router
  .route('/:courseId/quizzes/:id')
  .get(verifyJWT, requireCourseAccess, validate(getQuizSchema), getQuiz)
  .patch(verifyJWT, requireCourseTeacher, validate(updateQuizSchema), updateQuiz)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteQuizSchema), deleteQuiz);

router
  .route('/:courseId/quizzes/:id/publish')
  .patch(verifyJWT, requireCourseTeacher, validate(publishQuizSchema), publishQuiz);

router
  .route('/:courseId/quizzes/:quizId/questions')
  .post(verifyJWT, requireCourseTeacher, validate(createQuestionSchema), createQuestion);

router
  .route('/:courseId/quizzes/:quizId/questions/:id')
  .patch(verifyJWT, requireCourseTeacher, validate(updateQuestionSchema), updateQuestion)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteQuestionSchema), deleteQuestion);

router
  .route('/:courseId/quizzes/:id/attempts')
  .post(verifyJWT, requireEnrolledStudent, validate(submitAttemptSchema), submitAttempt)
  .get(verifyJWT, requireCourseTeacher, validate(listAttemptsSchema), listAttempts);

router
  .route('/:courseId/quizzes/:id/attempts/me')
  .get(verifyJWT, requireCourseAccess, validate(getMyAttemptSchema), getMyAttempt);

// LLM-backed — same limiter tier as AI grading (NFR-3/NFR-8).
router
  .route('/:courseId/quizzes/:id/attempts/:attemptId/questions/:questionId/grade')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(gradeShortAnswerSchema),
    gradeShortAnswer,
  )
  .patch(verifyJWT, requireCourseTeacher, validate(editShortAnswerGradeSchema), editShortAnswerGrade);

router
  .route('/:courseId/quizzes/:id/grade-short-answers')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(gradeAllShortAnswersSchema),
    gradeAllShortAnswers,
  );

export default router;
