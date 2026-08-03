'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AcademicYears', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      endDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      isCurrent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    // Partial unique index: at most one row can have isCurrent = true. This is
    // the DB-level backstop for the invariant the repository's transaction
    // maintains — see academicYears.repository.ts.
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX "academic_years_is_current_unique" ON "AcademicYears" ("isCurrent") WHERE "isCurrent" = true;`,
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AcademicYears');
  },
};
