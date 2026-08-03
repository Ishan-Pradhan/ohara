import { sequelize } from '../../src/config/db.js';

export const truncateAll = async (): Promise<void> => {
  await sequelize.query(
    'TRUNCATE TABLE "Verifications", "CourseTeachers", "Courses", "Sections", "Classes", "AcademicYears", "Programs", "Users" RESTART IDENTITY CASCADE',
  );
};

export const closeDb = async (): Promise<void> => {
  await sequelize.close();
};
