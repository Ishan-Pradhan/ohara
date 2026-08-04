'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('DocumentChunks', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      documentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      chunkIndex: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // bge-small-en-v1.5 outputs 384-dim vectors. Added via raw SQL rather than
    // a Sequelize column type — the pgvector Sequelize type registration
    // (pgvector/sequelize) is a runtime concern for the app process, not
    // something wired into the sequelize-cli migration runner.
    await queryInterface.sequelize.query(
      'ALTER TABLE "DocumentChunks" ADD COLUMN "embedding" vector(384) NOT NULL',
    );

    await queryInterface.addIndex('DocumentChunks', ['documentId', 'chunkIndex'], {
      unique: true,
      name: 'document_chunks_document_index_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('DocumentChunks');
  },
};
