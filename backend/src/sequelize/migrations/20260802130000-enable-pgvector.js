'use strict';

/**
 * Installs pgvector. Nothing uses it until Phase 3 (RAG ingestion); enabling it
 * now proves the extension is present in the server and fails loudly if not.
 *
 * Requires a PostgreSQL server with the pgvector extension available — e.g.
 * the pgvector/pgvector:pg16 image used by docker-compose.yml. A stock
 * postgres image does not ship it, and this migration will fail there.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS vector',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS vector');
  },
};
