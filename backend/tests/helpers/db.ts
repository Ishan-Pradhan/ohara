import { sequelize } from '../../src/config/db.js';

export const truncateAll = async (): Promise<void> => {
  await sequelize.query(
    'TRUNCATE TABLE "teacher_copilot_messages", "teacher_copilot_conversations", "admin_copilot_messages", "admin_copilot_conversations", "interventions", "study_plans", "institution_performance_insights", "institution_weekly_insights", "course_weekly_insights", "Events", "AttendanceRecords", "AttendanceSessions", "Notifications", "QuizAnswerGrades", "QuizAttempts", "Questions", "Quizzes", "Grades", "Submissions", "Assignments", "Verifications", "TutorMessages", "TutorConversations", "Lessons", "Modules", "DocumentChunks", "Documents", "Enrollments", "ClassMemberships", "CourseTeachers", "Courses", "Sections", "Classes", "AcademicYears", "Programs", "InstitutionProfile", "Users" RESTART IDENTITY CASCADE',
  );
};

export const closeDb = async (): Promise<void> => {
  await sequelize.close();
};
