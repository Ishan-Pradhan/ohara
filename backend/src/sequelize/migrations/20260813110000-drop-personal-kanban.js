'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Personal Kanban boards (Projects.type = 'personal', mounted at
  // /api/v1/me/kanban) had zero frontend across every phase of the project
  // and no mention in REQUIREMENTS.md — the same "unreachable feature"
  // pattern that already got course-scoped Kanban (ProjectMembers) removed
  // in 20260812140000-drop-project-members.js. Removing the rest of the
  // Kanban schema now that nothing references it.
  async up(queryInterface) {
    await queryInterface.dropTable('Tasks');
    await queryInterface.dropTable('BoardColumns');
    await queryInterface.dropTable('Projects');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Projects_type";');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('Projects', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Courses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('course', 'personal'),
        allowNull: false,
        defaultValue: 'course',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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

    await queryInterface.createTable('BoardColumns', {
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
      name: { type: Sequelize.STRING, allowNull: false },
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
    await queryInterface.addConstraint('BoardColumns', {
      fields: ['projectId', 'orderIndex'],
      type: 'unique',
      name: 'board_columns_project_order_unique',
    });

    await queryInterface.createTable('Tasks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      columnId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'BoardColumns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      assigneeId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
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
    await queryInterface.addIndex('Tasks', ['columnId', 'orderIndex']);
    await queryInterface.addIndex('Tasks', ['assigneeId']);
  },
};
