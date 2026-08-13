'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Institution-scoped counterpart to teacher_copilot_conversations — the
  // admin copilot was previously a single stateless Q&A with no persistence
  // (each question lost on refresh, no history). Now a real ChatGPT-style
  // thread per admin, same shape as the teacher copilot, minus courseId.
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_copilot_conversations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      adminId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'New conversation',
      },
      status: {
        type: Sequelize.ENUM('active', 'closed'),
        allowNull: false,
        defaultValue: 'active',
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

    await queryInterface.addIndex('admin_copilot_conversations', ['adminId'], {
      name: 'admin_copilot_conv_admin_idx',
    });

    await queryInterface.createTable('admin_copilot_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'admin_copilot_conversations', key: 'id' },
        onDelete: 'CASCADE',
      },
      seq: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('user', 'assistant'),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      dataContext: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Snapshot of deterministic data used to answer',
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

    await queryInterface.addIndex('admin_copilot_messages', ['conversationId', 'seq'], {
      name: 'admin_copilot_msg_conv_seq_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_copilot_messages');
    await queryInterface.dropTable('admin_copilot_conversations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_copilot_conversations_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_copilot_messages_role"');
  },
};
