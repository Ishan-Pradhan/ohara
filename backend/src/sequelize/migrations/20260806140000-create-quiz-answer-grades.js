'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('QuizAnswerGrades', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      attemptId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'QuizAttempts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      questionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Questions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      awardedPoints: { type: Sequelize.DECIMAL, allowNull: false },
      maxPoints: { type: Sequelize.DECIMAL, allowNull: false },
      feedback: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('draft', 'approved'),
        allowNull: false,
        defaultValue: 'draft',
      },
      approvedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
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
    await queryInterface.addConstraint('QuizAnswerGrades', {
      fields: ['attemptId', 'questionId'],
      type: 'unique',
      name: 'quiz_answer_grades_attempt_question_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('QuizAnswerGrades');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_QuizAnswerGrades_status";');
  },
};
