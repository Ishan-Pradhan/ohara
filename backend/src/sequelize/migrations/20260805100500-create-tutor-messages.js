'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TutorMessages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'TutorConversations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      seq: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('user', 'assistant', 'tool'),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('text', 'tool_call', 'tool_result', 'chart'),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      toolCalls: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      toolResult: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      sources: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      chart: {
        type: Sequelize.JSONB,
        allowNull: true,
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

    await queryInterface.addIndex('TutorMessages', ['conversationId', 'seq']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TutorMessages');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TutorMessages_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TutorMessages_type";');
  },
};
