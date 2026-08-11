'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('interventions', {
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
        onDelete: 'RESTRICT',
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Courses', key: 'id' },
        onDelete: 'CASCADE',
      },
      teacherId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      type: {
        type: Sequelize.ENUM('ai_generated', 'manual', 'meeting', 'tutoring', 'other'),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      actions: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of { description, timeline, resources? }',
      },
      status: {
        type: Sequelize.ENUM('active', 'resolved', 'dismissed'),
        allowNull: false,
        defaultValue: 'active',
      },
      resolvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('interventions', ['studentId', 'courseId'], {
      name: 'interventions_student_course_idx',
    });

    await queryInterface.addIndex('interventions', ['teacherId'], {
      name: 'interventions_teacher_idx',
    });

    await queryInterface.addIndex('interventions', ['courseId', 'status'], {
      name: 'interventions_course_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('interventions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_interventions_type"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_interventions_status"');
  },
};
