'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Courses', 'syllabusDocumentId', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'Documents', key: 'id' },
      onUpdate: 'CASCADE',
      // Same reasoning as knowledgeBaseDocumentId: deleting the selected
      // document just clears the course's selection rather than blocking
      // the delete — a course with no syllabus document is a valid,
      // ordinary state (generateSkeleton falls back to inventing structure
      // from the target document, same as before this field existed).
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Courses', 'syllabusDocumentId');
  },
};
