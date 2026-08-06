'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Assignments', {
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
      prompt: { type: Sequelize.TEXT, allowNull: false },
      rubric: { type: Sequelize.JSONB, allowNull: false },
      dueAt: { type: Sequelize.DATE, allowNull: false },
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

    await queryInterface.createTable('Submissions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      assignmentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Assignments', key: 'id' },
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
      content: { type: Sequelize.TEXT, allowNull: true },
      fileUrl: { type: Sequelize.STRING, allowNull: true },
      filePublicId: { type: Sequelize.STRING, allowNull: true },
      fileOriginalName: { type: Sequelize.STRING, allowNull: true },
      fileMimeType: { type: Sequelize.STRING, allowNull: true },
      isLate: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
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
    await queryInterface.addConstraint('Submissions', {
      fields: ['assignmentId', 'studentId'],
      type: 'unique',
      name: 'submissions_assignment_student_unique',
    });

    await queryInterface.createTable('Grades', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      submissionId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Submissions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      score: { type: Sequelize.DECIMAL, allowNull: false },
      criterionFeedback: { type: Sequelize.JSONB, allowNull: false },
      overallFeedback: { type: Sequelize.TEXT, allowNull: true },
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Grades');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Grades_status";');
    await queryInterface.dropTable('Submissions');
    await queryInterface.dropTable('Assignments');
  },
};
