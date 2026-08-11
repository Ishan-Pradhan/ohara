'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Was previously generated fresh via an LLM call on every single
    // GET /teacher/dashboard request — real AI cost and page-load latency on
    // every visit, and it blocked rendering the (non-AI) stats/courses too.
    // Now cached here, one row per teacher, regenerated only when the
    // teacher explicitly asks (POST /teacher/dashboard/insights) — same
    // teacher-triggered convention as At-Risk explanations, Lesson Planner,
    // and Intervention generation.
    await queryInterface.createTable('teacher_dashboard_insights', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      teacherId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('teacher_dashboard_insights');
  },
};
