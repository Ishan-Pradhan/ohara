'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Course-scoped team projects (Projects.type = 'course') were removed as
  // a feature nobody used — the only thing referencing ProjectMembers.
  // Personal Kanban boards (Projects.type = 'personal') never had members
  // and are unaffected; Projects/BoardColumns/Tasks all stay.
  async up(queryInterface) {
    await queryInterface.dropTable('ProjectMembers');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('ProjectMembers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      projectId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Projects', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
    await queryInterface.addConstraint('ProjectMembers', {
      fields: ['projectId', 'studentId'],
      type: 'unique',
      name: 'project_members_project_student_unique',
    });
  },
};
