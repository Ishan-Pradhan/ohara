import { sequelize } from '../../src/config/db.js';

export const truncateAll = async (): Promise<void> => {
  await sequelize.query(
    'TRUNCATE TABLE "Verifications", "Enrollments", "ClassMemberships", "CourseTeachers", "Courses", "Sections", "Classes", "AcademicYears", "Programs", "InstitutionProfile", "Users" RESTART IDENTITY CASCADE',
  );
};

export const closeDb = async (): Promise<void> => {
  await sequelize.close();
};
