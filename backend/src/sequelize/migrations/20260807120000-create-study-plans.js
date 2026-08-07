'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('study_plans', {
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
        onDelete: 'CASCADE',
      },
      weekStart: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'ISO date of the Monday this plan covers',
      },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Zod-validated AI-generated plan structure',
      },
      status: {
        type: Sequelize.ENUM('active', 'superseded'),
        allowNull: false,
        defaultValue: 'active',
      },
      generatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Only one active plan per student at a time
    await queryInterface.addIndex('study_plans', ['studentId', 'status'], {
      name: 'study_plans_student_active_idx',
      where: { status: 'active' },
    });

    await queryInterface.addIndex('study_plans', ['studentId', 'generatedAt'], {
      name: 'study_plans_student_generated_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('study_plans');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_study_plans_status"');
  },
};
