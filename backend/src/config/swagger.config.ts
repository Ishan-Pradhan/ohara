import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import { registry } from '../validations/registry.js';

// Importing these modules for their side effects is what populates the
// registry. A new schema module must be added here or its paths never appear.
import '../validations/user.response.js';
import '../validations/auth.validation.js';
import '../validations/admin.validation.js';
import '../validations/institution.validation.js';
import '../validations/placement.validation.js';
import '../validations/students.validation.js';
import '../validations/admission.validation.js';
import '../validations/assignments.validation.js';
import '../validations/submissions.validation.js';
import '../validations/quizzes.validation.js';
import '../validations/quizAttempts.validation.js';
import '../validations/gradebook.validation.js';
import '../validations/attendance.validation.js';
import '../validations/events.validation.js';
import '../validations/atRisk.validation.js';
import '../validations/transcript.validation.js';
import '../validations/bulkExamMarks.validation.js';
import '../validations/notifications.validation.js';
import '../validations/dashboard.validation.js';

registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'accessToken',
  description:
    'HTTP-only cookie set on login and register. Send credentials with every request.',
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const swaggerSpec = generator.generateDocument({
  openapi: '3.0.3',
  info: {
    title: 'Ohara API',
    version: '1.0.0',
    description:
      'REST API for Ohara — authentication, user administration, and (from Phase 2) academic management.',
  },
  servers: [{ url: '/api/v1', description: 'Current server' }],
  security: [{ cookieAuth: [] }],
  tags: [
    { name: 'Health', description: 'Server status' },
    { name: 'Auth', description: 'Register, login, logout, token management' },
    {
      name: 'Email Verification',
      description: 'Verify and resend confirmations',
    },
    { name: 'Password', description: 'Forgot, reset and change password' },
    { name: 'OAuth', description: 'Google and GitHub OAuth 2.0 flows' },
    { name: 'Admin', description: 'User management (admin only)' },
    { name: 'Institution', description: 'Academic hierarchy: programs, classes, academic years, sections, courses (admin only)' },
    { name: 'Placement', description: 'Student placement & enrollment (admin CRUD, plus a self-service view)' },
    { name: 'Admission', description: 'Single-request student admission: invite, place, and auto-enroll (admin only)' },
    { name: 'Assignments', description: 'Course assignments (admin/teacher create, students view)' },
    { name: 'Submissions', description: 'Student submissions and AI-assisted, teacher-approved grading' },
    { name: 'Quizzes', description: 'AI-generated or manually authored quizzes (admin/teacher create, students take)' },
    { name: 'Quiz Attempts', description: 'Student quiz attempts, MCQs auto-scored' },
    { name: 'Gradebook', description: 'Class gradebook aggregating approved assignment grades and quiz attempts' },
    { name: 'Attendance', description: 'Attendance sessions, present/absent/late marking, and per-student percentage' },
    { name: 'Events', description: 'Scoped events (global/program/class/section/course) and each user’s relevant upcoming events' },
    { name: 'At-Risk Analytics', description: 'Per-student risk metrics and AI-generated explanations' },
    { name: 'Transcripts', description: 'Academic transcripts grouping exam marks by semester' },
    { name: 'Notifications', description: 'In-app notification feed' },
    { name: 'Dashboard', description: 'Per-role landing page aggregation' },
  ],
});
