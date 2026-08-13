'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Institution Performance, Institution Weekly, and (per-course) Teacher
  // Weekly Intelligence were all generating fresh AI insights via an LLM
  // call on every single GET — real AI cost and page-load latency on every
  // visit, same bug already found and fixed for the teacher dashboard
  // (see 20260811120000-create-teacher-dashboard-insights.js). These three
  // tables cache the same way: content regenerated only when explicitly
  // requested (POST .../insights), never automatically on read.
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('institution_performance_insights', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Zod-validated {summary, highlights, concerns, recommendations}',
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

    await queryInterface.createTable('institution_weekly_insights', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      weekStart: { type: Sequelize.DATEONLY, allowNull: false },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Zod-validated {summary, highlights, concerns, recommendations}',
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

    await queryInterface.createTable('course_weekly_insights', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Courses', key: 'id' },
        onDelete: 'CASCADE',
      },
      weekStart: { type: Sequelize.DATEONLY, allowNull: false },
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Zod-validated {summary, highlights, concerns, recommendations}',
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('course_weekly_insights');
    await queryInterface.dropTable('institution_weekly_insights');
    await queryInterface.dropTable('institution_performance_insights');
  },
};
