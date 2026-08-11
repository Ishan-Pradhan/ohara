import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import pinoHttp from 'pino-http';

import { logger } from './utils/logger.js';

import { env } from './config/env.js';
import { limiter } from './middlewares/rateLimiter.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { swaggerSpec } from './config/swagger.config.js';
// Side-effect import: constructing the Sequelize instance is what registers
// the models. Without it, any model used through this app is uninitialized.
import './config/db.js';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import institutionRoutes from './routes/institution.routes.js';
import placementRoutes from './routes/placement.routes.js';
import admissionRoutes from './routes/admission.routes.js';
import studentsRoutes from './routes/students.routes.js';
import institutionProfileRoutes from './routes/institutionProfile.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import courseContentRoutes from './routes/courseContent.routes.js';
import tutorRoutes from './routes/tutor.routes.js';
import electivesRoutes from './routes/electives.routes.js';
import assignmentsRoutes from './routes/assignments.routes.js';
import quizzesRoutes from './routes/quizzes.routes.js';
import gradebookRoutes from './routes/gradebook.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import kanbanRoutes from './routes/kanban.routes.js';
import atRiskRoutes from './routes/atRisk.routes.js';
import examTermsRoutes from './routes/examTerms.routes.js';
import examMarksRoutes from './routes/examMarks.routes.js';
import personalKanbanRoutes from './routes/personalKanban.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import eventsRoutes from './routes/events.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import healthRoutes from './routes/health.routes.js';
import classIntelligenceRoutes from './routes/classIntelligence.routes.js';
import interventionRoutes from './routes/intervention.routes.js';
import teacherCopilotRoutes from './routes/teacherCopilot.routes.js';
import lessonPlannerRoutes from './routes/lessonPlanner.routes.js';
import weeklyIntelligenceRoutes from './routes/weeklyIntelligence.routes.js';
import gradeTrendsRoutes from './routes/gradeTrends.routes.js';
import attendanceTrendsRoutes from './routes/attendanceTrends.routes.js';
import studentProfileRoutes from './routes/studentProfile.routes.js';
import birthdayRoutes from './routes/birthdays.routes.js';

export const app = express();

app.set('trust proxy', 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(limiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin', birthdayRoutes);
app.use('/api/v1/admin', institutionRoutes);
app.use('/api/v1/admin', placementRoutes);
app.use('/api/v1/admin', admissionRoutes);
app.use('/api/v1/students', studentsRoutes);
app.use('/api/v1/students', studentProfileRoutes);
app.use('/api/v1/courses', documentsRoutes);
app.use('/api/v1/courses', courseContentRoutes);
app.use('/api/v1/courses', tutorRoutes);
app.use('/api/v1/courses', assignmentsRoutes);
app.use('/api/v1/courses', quizzesRoutes);
app.use('/api/v1/courses', gradebookRoutes);
app.use('/api/v1/courses', attendanceRoutes);
app.use('/api/v1/courses', kanbanRoutes);
app.use('/api/v1/courses', atRiskRoutes);
app.use('/api/v1/courses', examMarksRoutes);
app.use('/api/v1/courses', classIntelligenceRoutes);
app.use('/api/v1/courses', interventionRoutes);
app.use('/api/v1/courses', teacherCopilotRoutes);
app.use('/api/v1/courses', lessonPlannerRoutes);
app.use('/api/v1/courses', weeklyIntelligenceRoutes);
app.use('/api/v1/courses', gradeTrendsRoutes);
app.use('/api/v1/courses', attendanceTrendsRoutes);
// electivesRoutes applies a blanket router.use(verifyJWT, requireRole(STUDENT))
// to everything mounted here — every other /api/v1/courses router (teacher/
// admin routes included) must be registered above this line, or their
// requests get rejected by that student-only gate before ever reaching them.
app.use('/api/v1/courses', electivesRoutes);
app.use('/api/v1/teacher', teacherRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/exam-terms', examTermsRoutes);
app.use('/api/v1/me/kanban', personalKanbanRoutes);
app.use('/api/v1', institutionProfileRoutes);
app.use('/api/v1', healthRoutes);

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Ohara API',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
  }),
);

app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('<h1>Ohara API</h1>');
});

app.use((_req: Request, res: Response) => {
  return res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);
