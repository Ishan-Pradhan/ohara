'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Assignments/Quizzes were only ever scoped by courseId, and a Course is
    // permanently attached to a Class (e.g. "Semester 3") rather than
    // re-created per academic year — so once a batch is promoted out and a
    // new batch reaches the same class next year, the new batch inherited
    // every assignment/quiz (and its now-stale due date) the previous batch's
    // teacher ever created for that course. academicYearId is NOT NULL with
    // no sensible default/backfill (existing rows can't be retroactively
    // attributed to a specific batch's real academic year), so — matching the
    // batchId-on-ClassMemberships precedent — existing rows are cleared as
    // placeholder dev data rather than backfilled. CASCADE clears dependent
    // Submissions/Grades/Questions/QuizAttempts/QuizAnswerGrades too.
    await queryInterface.sequelize.query(
      'TRUNCATE "Assignments", "Quizzes" RESTART IDENTITY CASCADE;',
    );

    await queryInterface.addColumn('Assignments', 'academicYearId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'AcademicYears', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.addColumn('Quizzes', 'academicYearId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'AcademicYears', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Assignments', 'academicYearId');
    await queryInterface.removeColumn('Quizzes', 'academicYearId');
  },
};
