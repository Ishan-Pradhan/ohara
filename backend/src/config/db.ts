import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';

import { env } from './env.js';
import { User } from '../models/users.model.js';
import { Verification } from '../models/verification.model.js';
import { Program } from '../models/programs.model.js';
import { Batch } from '../models/batches.model.js';
import { Class } from '../models/classes.model.js';
import { AcademicYear } from '../models/academicYears.model.js';
import { Section } from '../models/sections.model.js';
import { Course } from '../models/courses.model.js';
import { CourseTeacher } from '../models/courseTeachers.model.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { Enrollment } from '../models/enrollments.model.js';
import { InstitutionProfile } from '../models/institutionProfile.model.js';
import { Document } from '../models/documents.model.js';
import { DocumentChunk } from '../models/documentChunks.model.js';
import { Module } from '../models/modules.model.js';
import { Lesson } from '../models/lessons.model.js';
import { StudentProfile } from '../models/studentProfiles.model.js';
import { StudentFlag } from '../models/studentFlags.model.js';
import { TutorConversation } from '../models/tutorConversations.model.js';
import { TutorMessage } from '../models/tutorMessages.model.js';
import { Assignment } from '../models/assignments.model.js';
import { Submission } from '../models/submissions.model.js';
import { Grade } from '../models/grades.model.js';
import { Quiz } from '../models/quizzes.model.js';
import { Question } from '../models/questions.model.js';
import { QuizAttempt } from '../models/quizAttempts.model.js';
import { QuizAnswerGrade } from '../models/quizAnswerGrades.model.js';
import { Notification } from '../models/notifications.model.js';
import { AttendanceSession } from '../models/attendanceSessions.model.js';
import { AttendanceRecord } from '../models/attendanceRecords.model.js';

// Under test the app must talk to the throwaway test database. Without this
// the integration suites connect to - and truncate - the development database,
// because they share this Sequelize instance.
const database =
  env.NODE_ENV === 'test' && env.DB_NAME_TEST ? env.DB_NAME_TEST : env.DB_NAME;

export const sequelize = new Sequelize({
  database,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'postgres',
  logging: false,
  models: [
    User,
    Verification,
    Program,
    Batch,
    Class,
    AcademicYear,
    Section,
    Course,
    CourseTeacher,
    ClassMembership,
    Enrollment,
    InstitutionProfile,
    Document,
    DocumentChunk,
    Module,
    Lesson,
    StudentProfile,
    StudentFlag,
    TutorConversation,
    TutorMessage,
    Assignment,
    Submission,
    Grade,
    Quiz,
    Question,
    QuizAttempt,
    QuizAnswerGrade,
    Notification,
    AttendanceSession,
    AttendanceRecord,
  ],
});
