'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Courses', 'knowledgeBaseDocumentId', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'Documents', key: 'id' },
      onUpdate: 'CASCADE',
      // Deleting the selected document just clears the course's selection
      // rather than blocking the delete or cascading further — a course
      // with no knowledge base document is a valid, ordinary state (the
      // tutor/quiz RAG paths already treat "unset" as "no material").
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Courses', 'knowledgeBaseDocumentId');
  },
};
