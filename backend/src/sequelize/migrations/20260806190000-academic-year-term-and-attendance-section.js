'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Odd/even semesters (1/3/5/7 vs 2/4/6/8) run on offset calendars in
    // Nepal's college/university system, so both can be legitimately
    // "current" at once — a single global isCurrent flag can't represent
    // that. `term` lets "current" become unique per-term instead of
    // globally. `annual` is the default (and the only value schools use,
    // which don't split into odd/even semesters at all) so existing rows
    // don't need backfilling beyond this default.
    await queryInterface.addColumn('AcademicYears', 'term', {
      type: Sequelize.ENUM('odd', 'even', 'annual'),
      allowNull: false,
      defaultValue: 'annual',
    });

    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS "academic_years_is_current_unique";`,
    );
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX "academic_years_is_current_per_term_unique" ON "AcademicYears" ("term") WHERE "isCurrent" = true;`,
    );

    // Attendance is taken per class meeting, which is always one specific
    // section (a course can be taught to several sections of the same
    // class) — courseId alone let a session's roster leak across sections.
    await queryInterface.addColumn('AttendanceSessions', 'sectionId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Sections', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('AttendanceSessions', 'sectionId');
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS "academic_years_is_current_per_term_unique";`,
    );
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX "academic_years_is_current_unique" ON "AcademicYears" ("isCurrent") WHERE "isCurrent" = true;`,
    );
    await queryInterface.removeColumn('AcademicYears', 'term');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AcademicYears_term";');
  },
};
