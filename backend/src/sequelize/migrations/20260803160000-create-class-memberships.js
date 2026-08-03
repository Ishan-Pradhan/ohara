'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ClassMemberships', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      sectionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Sections', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      academicYearId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'AcademicYears', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      outcome: {
        type: Sequelize.ENUM('enrolled', 'promoted', 'retained', 'graduated'),
        allowNull: false,
        defaultValue: 'enrolled',
      },
      promotedToId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ClassMemberships', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('ClassMemberships', ['studentId', 'academicYearId'], {
      unique: true,
      name: 'class_memberships_student_year_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ClassMemberships');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_ClassMemberships_outcome";',
    );
  },
};
