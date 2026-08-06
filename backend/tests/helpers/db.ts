import { sequelize } from '../../src/config/db.js';

export const truncateAll = async (): Promise<void> => {
  await sequelize.query(
    'TRUNCATE TABLE "Events", "AttendanceRecords", "AttendanceSessions", "Notifications", "QuizAnswerGrades", "QuizAttempts", "Questions", "Quizzes", "Grades", "Submissions", "Assignments", "Verifications", "TutorMessages", "TutorConversations", "Lessons", "Modules", "DocumentChunks", "Documents", "Enrollments", "ClassMemberships", "CourseTeachers", "Courses", "Sections", "Classes", "AcademicYears", "Programs", "InstitutionProfile", "Users" RESTART IDENTITY CASCADE',
  );
};

export const closeDb = async (): Promise<void> => {
  await sequelize.close();
};
