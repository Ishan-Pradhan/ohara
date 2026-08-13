'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CourseStudyAids', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Courses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      lessonId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Lessons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('summary', 'flashcards'),
        allowNull: false,
      },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      generatedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Shared/cached per (course, lesson, type) — one summary and one
    // flashcard set per lesson, and separately one of each for the course
    // as a whole (lessonId null). Partial indexes because a plain
    // UNIQUE(courseId, lessonId, type) would treat every NULL lessonId as
    // distinct in Postgres, not enforcing "only one course-wide row" at all.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX course_study_aids_lesson_unique
      ON "CourseStudyAids" ("lessonId", "type")
      WHERE "lessonId" IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX course_study_aids_course_wide_unique
      ON "CourseStudyAids" ("courseId", "type")
      WHERE "lessonId" IS NULL;
    `);
    await queryInterface.addIndex('CourseStudyAids', ['courseId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CourseStudyAids');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CourseStudyAids_type";');
  },
};
