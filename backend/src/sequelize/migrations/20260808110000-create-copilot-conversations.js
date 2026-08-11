'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('teacher_copilot_conversations', {
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
        onDelete: 'CASCADE',
      },
      teacherId: {
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

    await queryInterface.addIndex('teacher_copilot_conversations', ['teacherId', 'courseId'], {
      name: 'copilot_conv_teacher_course_idx',
    });

    await queryInterface.createTable('teacher_copilot_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      conversationId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'teacher_copilot_conversations', key: 'id' },
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

    await queryInterface.addIndex('teacher_copilot_messages', ['conversationId', 'seq'], {
      name: 'copilot_msg_conv_seq_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('teacher_copilot_messages');
    await queryInterface.dropTable('teacher_copilot_conversations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_teacher_copilot_conversations_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_teacher_copilot_messages_role"');
  },
};
