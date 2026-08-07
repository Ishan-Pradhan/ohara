'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // A project is either a course team project (courseId set) or a
    // student's personal board (ownerId set) — `type` disambiguates so
    // queries don't have to infer it from which FK is populated.
    await queryInterface.changeColumn('Projects', 'courseId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('Projects', 'ownerId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addColumn('Projects', 'type', {
      type: Sequelize.ENUM('course', 'personal'),
      allowNull: false,
      defaultValue: 'course',
    });

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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ProjectMembers');
    await queryInterface.removeColumn('Projects', 'type');
    await queryInterface.removeColumn('Projects', 'ownerId');
    await queryInterface.changeColumn('Projects', 'courseId', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Projects_type";');
  },
};
