'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Quizzes', {
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
      title: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
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

    await queryInterface.createTable('Questions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      quizId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Quizzes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('mcq', 'short_answer'),
        allowNull: false,
      },
      prompt: { type: Sequelize.TEXT, allowNull: false },
      options: { type: Sequelize.JSONB, allowNull: true },
      answer: { type: Sequelize.JSONB, allowNull: true },
      points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      orderIndex: { type: Sequelize.INTEGER, allowNull: false },
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
    await queryInterface.addIndex('Questions', ['quizId', 'orderIndex']);

    await queryInterface.createTable('QuizAttempts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      quizId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Quizzes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      responses: { type: Sequelize.JSONB, allowNull: false },
      score: { type: Sequelize.DECIMAL, allowNull: false },
      maxScore: { type: Sequelize.DECIMAL, allowNull: false },
      submittedAt: { type: Sequelize.DATE, allowNull: false },
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
    await queryInterface.addConstraint('QuizAttempts', {
      fields: ['quizId', 'studentId'],
      type: 'unique',
      name: 'quiz_attempts_quiz_student_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('QuizAttempts');
    await queryInterface.dropTable('Questions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Questions_type";');
    await queryInterface.dropTable('Quizzes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Quizzes_status";');
  },
};
