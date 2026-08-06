'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM(
          'assignment_created',
          'assignment_graded',
          'quiz_published',
          'quiz_graded',
        ),
        allowNull: false,
      },
      title: { type: Sequelize.STRING, allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: true },
      link: { type: Sequelize.STRING, allowNull: true },
      isRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
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
    await queryInterface.addIndex('Notifications', ['userId', 'isRead']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Notifications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Notifications_type";');
  },
};
