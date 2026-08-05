'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // batchId is NOT NULL with no default, and this repo's dev/test data
    // predates the batch model entirely (see the design spec's explicit
    // "no data migration, start fresh" decision — docs/superpowers/specs/
    // 2026-08-05-semester-batch-model-design.md). Any existing rows here are
    // placeholder dev data, not real academic history, so they're cleared
    // rather than backfilled. CASCADE is required because promotedToId
    // self-references this same table.
    await queryInterface.sequelize.query('TRUNCATE "ClassMemberships" RESTART IDENTITY CASCADE;');

    await queryInterface.addColumn('ClassMemberships', 'batchId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'Batches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ClassMemberships', 'batchId');
  },
};
