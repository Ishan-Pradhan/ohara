import { sequelize } from '../../src/config/db.js';

export const truncateAll = async (): Promise<void> => {
  await sequelize.query(
    'TRUNCATE TABLE "Verifications", "ClassMemberships", "CourseTeachers", "Courses", "Sections", "AcademicYears", "Programs", "Users" RESTART IDENTITY CASCADE',
  );
};

export const closeDb = async (): Promise<void> => {
  await sequelize.close();
};
