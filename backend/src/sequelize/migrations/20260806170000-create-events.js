'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      startAt: { type: Sequelize.DATE, allowNull: false },
      audience: {
        type: Sequelize.ENUM('global', 'program', 'class', 'section', 'course'),
        allowNull: false,
      },
      programId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Programs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      classId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Classes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sectionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Sections', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Courses', key: 'id' },
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
    await queryInterface.addIndex('Events', ['startAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Events');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Events_audience";');
  },
};
